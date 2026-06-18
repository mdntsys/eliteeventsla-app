"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireModule } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe";
import type { ActionState } from "@/lib/accounting/types";

/**
 * Server actions for the accounting module. Every action gates on
 * requireModule("accounting") (defense in depth alongside RLS), validates with
 * zod, mutates via the typed server client, revalidates affected paths, and
 * returns an ActionState (or redirects). Stripe is used only behind getStripe(),
 * which throws when STRIPE_SECRET_KEY is absent — callers degrade gracefully.
 */

// --- Reusable coercions -----------------------------------------------------

const optionalText = z
  .string()
  .transform((v) => {
    const t = v.trim();
    return t === "" ? null : t;
  })
  .nullable();

const optionalUuid = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || z.uuid().safeParse(v).success, {
    message: "Invalid id.",
  })
  .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : v));

/** Required, non-negative money amount. */
const money = z.coerce
  .number()
  .refine((n) => Number.isFinite(n) && n >= 0, "Enter a valid amount.");

/** Optional, non-negative money amount (empty -> 0). */
const optionalMoney = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Enter a valid amount." },
  )
  .transform((v) => (v === "" ? 0 : Number(v)));

const invoiceStatusEnum = z.enum([
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "void",
]);
const paymentMethodEnum = z.enum([
  "card",
  "cash",
  "check",
  "bank_transfer",
  "stripe",
]);
const paymentStatusEnum = z.enum([
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
]);

const LineItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0),
  unit_price: z.coerce.number().refine((n) => Number.isFinite(n) && n >= 0),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** Round to cents to avoid float drift in stored money. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const CreateInvoiceSchema = z.object({
  event_id: optionalUuid,
  contact_id: optionalUuid,
  company_id: optionalUuid,
  invoice_number: optionalText,
  status: invoiceStatusEnum.default("draft"),
  tax: optionalMoney,
  issued_date: optionalDate,
  due_date: optionalDate,
  notes: optionalText,
});

// --- Invoices ---------------------------------------------------------------

export async function createInvoice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("accounting");

  const parsed = CreateInvoiceSchema.safeParse({
    event_id: formData.get("event_id"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    invoice_number: formData.get("invoice_number"),
    status: formData.get("status") ?? undefined,
    tax: formData.get("tax"),
    issued_date: formData.get("issued_date"),
    due_date: formData.get("due_date"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  // Parse + validate the line items the form submits as a JSON array.
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
  const subtotal = round2(lineItems.reduce((sum, it) => sum + it.amount, 0));
  const tax = round2(data.tax);
  const total = round2(subtotal + tax);
  const invoiceNumber =
    data.invoice_number ?? `INV-${Date.now().toString(36).toUpperCase()}`;

  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("invoices")
    .insert({
      event_id: data.event_id,
      contact_id: data.contact_id,
      company_id: data.company_id,
      invoice_number: invoiceNumber,
      status: data.status,
      subtotal,
      tax,
      total_amount: total,
      amount_paid: 0,
      issued_date: data.issued_date,
      due_date: data.due_date,
      notes: data.notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code === "23505") {
      return { error: "That invoice number is already in use." };
    }
    return { error: error?.message ?? "Could not create the invoice." };
  }

  const { error: itemsError } = await supabase
    .from("invoice_line_items")
    .insert(
      lineItems.map((it) => ({ ...it, invoice_id: inserted.id })),
    );
  if (itemsError) {
    return { error: itemsError.message };
  }

  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/accounting/invoices/${inserted.id}`);
}

const UpdateInvoiceStatusSchema = z.object({
  id: z.uuid("An invoice is required."),
  status: invoiceStatusEnum,
});

export async function updateInvoiceStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("accounting");

  const parsed = UpdateInvoiceStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath(`/accounting/invoices/${parsed.data.id}`);
  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting");
  return { success: true };
}

// --- Payments ---------------------------------------------------------------

const RecordPaymentSchema = z.object({
  invoice_id: optionalUuid,
  event_id: optionalUuid,
  amount: money,
  method: paymentMethodEnum.default("card"),
  status: paymentStatusEnum.default("succeeded"),
  paid_at: optionalDate,
  notes: optionalText,
});

/**
 * Recompute an invoice's amount_paid from its succeeded payments and move its
 * status to paid/partial accordingly. Never downgrades a manually-set status
 * below what the money implies; leaves draft/void alone.
 */
async function reconcileInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
): Promise<void> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_amount, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return;

  const { data: pays } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("invoice_id", invoiceId);

  const paid = round2(
    (pays ?? [])
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + (p.amount ?? 0), 0),
  );

  const total = invoice.total_amount ?? 0;
  let status = invoice.status;
  if (invoice.status !== "void" && invoice.status !== "draft") {
    if (total > 0 && paid >= total) status = "paid";
    else if (paid > 0) status = "partial";
  }

  await supabase
    .from("invoices")
    .update({ amount_paid: paid, status })
    .eq("id", invoiceId);
}

export async function recordPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("accounting");

  const parsed = RecordPaymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    event_id: formData.get("event_id"),
    amount: formData.get("amount"),
    method: formData.get("method") ?? undefined,
    status: formData.get("status") ?? undefined,
    paid_at: formData.get("paid_at"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const paidAt =
    data.status === "succeeded"
      ? (data.paid_at ?? new Date().toISOString())
      : data.paid_at;

  const { error } = await supabase.from("payments").insert({
    invoice_id: data.invoice_id,
    event_id: data.event_id,
    amount: round2(data.amount),
    currency: "usd",
    method: data.method,
    status: data.status,
    paid_at: paidAt,
    notes: data.notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  if (data.invoice_id) {
    await reconcileInvoice(supabase, data.invoice_id);
    revalidatePath(`/accounting/invoices/${data.invoice_id}`);
  }
  revalidatePath("/accounting/payments");
  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting");
  return { success: true };
}

// --- Stripe payment link ----------------------------------------------------

const StripeLinkSchema = z.object({
  invoice_id: z.uuid("An invoice is required."),
});

export async function createStripePaymentLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("accounting");

  const parsed = StripeLinkSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!invoice) return { error: "Invoice not found." };
  if ((invoice.total_amount ?? 0) <= 0) {
    return { error: "Add line items before creating a payment link." };
  }

  try {
    const stripe = getStripe();
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: Math.round((invoice.total_amount ?? 0) * 100),
      product_data: { name: `Invoice ${invoice.invoice_number ?? invoice.id}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { invoice_id: invoice.id },
    });

    const user = await getUser();
    await supabase.from("payments").insert({
      invoice_id: invoice.id,
      amount: round2(invoice.total_amount ?? 0),
      currency: "usd",
      method: "stripe",
      status: "pending",
      stripe_payment_link_id: link.id,
      notes: "Stripe payment link",
      created_by: user?.id ?? null,
    });

    revalidatePath(`/accounting/invoices/${invoice.id}`);
    return { success: true, url: link.url ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return {
        stripeUnconfigured: true,
        error:
          "Stripe isn't connected yet. Add STRIPE_SECRET_KEY to enable payment links.",
      };
    }
    return { error: message };
  }
}
