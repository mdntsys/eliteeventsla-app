"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, requireEdit } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/quotes/types";
import {
  optionalDate,
  optionalMoneyZero as optionalMoney,
  optionalText,
  optionalUuid,
} from "@/lib/forms/coercions";

/**
 * Server actions for quotes. Gate on requireEdit("quotes") (quotes are their
 * own area), validate with zod, compute totals server-side, and revalidate.
 * convertQuote mirrors convertDealToEvent: it spins up an event + a draft
 * invoice from an accepted quote (admin has rights to all three tables).
 */

const quoteStatusEnum = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
]);

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0),
  unit_price: z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0),
});

const CreateQuoteSchema = z.object({
  title: optionalText,
  contact_id: optionalUuid,
  company_id: optionalUuid,
  deal_id: optionalUuid,
  valid_until: optionalDate,
  notes: optionalText,
  tax: optionalMoney,
  status: quoteStatusEnum.optional().default("draft"),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form.";
}

export async function createQuote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("quotes");

  const parsed = CreateQuoteSchema.safeParse({
    title: formData.get("title"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    deal_id: formData.get("deal_id"),
    valid_until: formData.get("valid_until"),
    notes: formData.get("notes"),
    tax: formData.get("tax"),
    status: formData.get("status") ?? undefined,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("line_items") ?? "[]"));
  } catch {
    return { error: "Could not read the line items." };
  }
  const itemsParsed = z.array(LineItemSchema).safeParse(rawItems);
  if (!itemsParsed.success) {
    return { error: "Each line needs a description, quantity, and price." };
  }
  const lineItems = itemsParsed.data
    .filter((it) => it.description.trim() !== "")
    .map((it) => ({
      description: it.description.trim(),
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: round2(it.quantity * it.unit_price),
    }));
  if (lineItems.length === 0) {
    return { error: "Add at least one line item." };
  }

  const data = parsed.data;
  const subtotal = round2(lineItems.reduce((s, it) => s + it.amount, 0));
  const tax = round2(data.tax);
  const total = round2(subtotal + tax);
  const quoteNumber = `Q-${Date.now().toString(36).toUpperCase()}`;

  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("quotes")
    .insert({
      quote_number: quoteNumber,
      title: data.title,
      contact_id: data.contact_id,
      company_id: data.company_id,
      deal_id: data.deal_id,
      status: data.status,
      subtotal,
      tax,
      total_amount: total,
      valid_until: data.valid_until,
      notes: data.notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return { error: "That quote number is already in use." };
    }
    return { error: error?.message ?? "Could not create the quote." };
  }

  const { error: itemsError } = await supabase
    .from("quote_line_items")
    .insert(lineItems.map((it) => ({ ...it, quote_id: inserted.id })));
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/crm/quotes");
  redirect(`/crm/quotes/${inserted.id}`);
}

const SetStatusSchema = z.object({
  id: z.uuid(),
  status: quoteStatusEnum,
});

export async function setQuoteStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("quotes");
  const parsed = SetStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath(`/crm/quotes/${parsed.data.id}`);
  revalidatePath("/crm/quotes");
  return { success: true };
}

const DeleteSchema = z.object({ id: z.uuid() });

export async function deleteQuote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("quotes");
  const parsed = DeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/crm/quotes");
  redirect("/crm/quotes");
}

const ConvertSchema = z.object({ id: z.uuid() });

/**
 * Accept → realize: an accepted quote becomes a DRAFT event + a SENT invoice
 * (line items copied), and the quote is marked converted with both links set.
 *
 * The event is born 'draft' so the client's payment activates it (draft →
 * confirmed), matching the deal→event path. The invoice is born 'sent' (not
 * draft) because it's a realized bill that will carry a payment link — a draft
 * invoice would be skipped by reconcile and never mark paid.
 *
 * The three table writes (events, invoices, quote) span areas, so a sales user
 * with quotes-edit but not accounting-edit would otherwise fail the invoice
 * insert mid-flow and orphan the event. After the requireEdit('quotes')
 * authority check we perform the writes with the service-role client (when
 * available) so the realization succeeds as a unit. Idempotent: refuses an
 * already-converted quote.
 */
export async function convertQuote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("quotes");
  const parsed = ConvertSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id } = parsed.data;

  const user = await getUser();
  const supabase = await createClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select(
      "id, title, contact_id, company_id, deal_id, status, subtotal, tax, total_amount, event_id, invoice_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (qErr) return { error: qErr.message };
  if (!quote) return { error: "That quote could not be found." };
  if (quote.status === "converted" || quote.event_id || quote.invoice_id) {
    return { error: "This quote has already been converted." };
  }

  const { data: lineItems, error: liErr } = await supabase
    .from("quote_line_items")
    .select("description, quantity, unit_price, amount")
    .eq("quote_id", id);
  if (liErr) return { error: liErr.message };

  // Authorized via requireEdit('quotes'); realize across areas with elevated
  // privilege so the event/invoice/quote writes succeed as a unit.
  let db: SupabaseClient;
  try {
    db = createServiceClient();
  } catch {
    db = supabase;
  }

  // 1) Event (draft — payment activates it)
  const { data: event, error: evErr } = await db
    .from("events")
    .insert({
      title: quote.title ?? "Event from quote",
      contact_id: quote.contact_id,
      company_id: quote.company_id,
      event_type: "other",
      status: "draft",
      total_amount: quote.total_amount,
      deal_id: quote.deal_id,
      owner_id: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (evErr || !event) {
    return { error: evErr?.message ?? "Could not create the event." };
  }

  // 2) Sent invoice from the quote totals (a real bill, ready for a link)
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const { data: invoice, error: invErr } = await db
    .from("invoices")
    .insert({
      event_id: event.id,
      contact_id: quote.contact_id,
      company_id: quote.company_id,
      invoice_number: invoiceNumber,
      status: "sent",
      subtotal: quote.subtotal,
      tax: quote.tax,
      total_amount: quote.total_amount,
      amount_paid: 0,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (invErr || !invoice) {
    return { error: invErr?.message ?? "Could not create the invoice." };
  }

  if (lineItems && lineItems.length > 0) {
    const { error: copyErr } = await db
      .from("invoice_line_items")
      .insert(lineItems.map((it) => ({ ...it, invoice_id: invoice.id })));
    if (copyErr) return { error: copyErr.message };
  }

  // 3) Mark the quote converted + link both records
  const { error: updErr } = await db
    .from("quotes")
    .update({
      status: "converted",
      event_id: event.id,
      invoice_id: invoice.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) return { error: updErr.message };

  revalidatePath(`/crm/quotes/${id}`);
  revalidatePath("/crm/quotes");
  revalidatePath("/events");
  revalidatePath("/accounting/invoices");
  redirect(`/events/${event.id}`);
}
