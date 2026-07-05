"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, requireEdit } from "@/lib/auth/dal";
import { getStripe } from "@/lib/stripe";
import { reconcileInvoiceAndActivateEvent } from "@/lib/accounting/reconcile";
import { getInvoiceByToken } from "@/lib/invoices/public";
import { formatDate } from "@/lib/accounting/format";
import {
  notifyPaymentLink,
  notifyInvoice,
  notifyInvoiceVoided,
} from "@/lib/email/send";
import type { ActionState } from "@/lib/accounting/types";
import {
  money,
  optionalDate,
  optionalMoneyZero as optionalMoney,
  optionalText,
  optionalUuid,
} from "@/lib/forms/coercions";

/**
 * Server actions for the accounting module. Every action gates on
 * requireEdit("accounting") (defense in depth alongside RLS), validates with
 * zod, mutates via the typed server client, revalidates affected paths, and
 * returns an ActionState (or redirects). Stripe is used only behind getStripe(),
 * which throws when STRIPE_SECRET_KEY is absent — callers degrade gracefully.
 */

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
  await requireEdit("accounting");

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
  await requireEdit("accounting");

  const parsed = UpdateInvoiceStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  // Load the invoice + its client BEFORE updating: we need the prior status to
  // detect a real void transition, and the client's email/name to notify them.
  const { data: before, error: loadError } = await supabase
    .from("invoices")
    .select(
      "id, status, invoice_number, total_amount, contacts(first_name, last_name, email), companies(name, email)",
    )
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!before) return { error: "Invoice not found." };

  const { error } = await supabase
    .from("invoices")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath(`/accounting/invoices/${parsed.data.id}`);
  revalidatePath("/accounting/invoices");
  revalidatePath("/accounting");

  // On a genuine void — an already-issued invoice moving to 'void' — email the
  // client that it's been voided and BCC the team. Skip drafts (never sent to
  // the client) and no-op re-voids. A failed/absent email must NOT fail the
  // status change, so we report it as a soft note alongside success.
  type ClientRow = {
    status: string;
    invoice_number: string | null;
    total_amount: number | null;
    contacts: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
    companies: { name: string | null; email: string | null } | null;
  };
  const inv = before as unknown as ClientRow;
  const becameVoid =
    parsed.data.status === "void" &&
    inv.status !== "void" &&
    inv.status !== "draft";

  if (becameVoid) {
    // Deactivate any live Stripe payment link for this invoice so the void
    // notice's "now inactive" promise actually holds — otherwise a client could
    // still pay a voided invoice, which the webhook would reconcile and (worse)
    // use to activate the linked event for a cancelled booking. Guarded like
    // ensurePaymentLink so a Stripe outage/misconfig can't fail the void itself.
    try {
      const stripe = getStripe();
      const { data: pendingLinks } = await supabase
        .from("payments")
        .select("stripe_payment_link_id")
        .eq("invoice_id", parsed.data.id)
        .eq("method", "stripe")
        .eq("status", "pending")
        .not("stripe_payment_link_id", "is", null);
      for (const row of pendingLinks ?? []) {
        if (row.stripe_payment_link_id) {
          await stripe.paymentLinks.update(row.stripe_payment_link_id, {
            active: false,
          });
        }
      }
    } catch {
      // Stripe unconfigured or an API error must not block the status change.
    }

    const to = inv.contacts?.email ?? inv.companies?.email ?? null;
    if (!to) {
      return {
        success: true,
        error:
          "Invoice voided. No email on file for the client, so no notice was sent.",
      };
    }
    const recipientName =
      [inv.contacts?.first_name, inv.contacts?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      inv.companies?.name ||
      null;
    const amountText =
      inv.total_amount != null
        ? `$${round2(inv.total_amount).toFixed(2)}`
        : null;

    const send = await notifyInvoiceVoided(to, {
      invoiceNumber: inv.invoice_number,
      amountText,
      recipientName,
    });
    if (send.ok) return { success: true, emailedTo: to };
    if (send.skipped) {
      return {
        success: true,
        error:
          "Invoice voided. Email isn't configured (RESEND_API_KEY missing), so the client wasn't notified.",
      };
    }
    return {
      success: true,
      error: `Invoice voided, but the void notice failed to send: ${send.error ?? "unknown error"}.`,
    };
  }

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
 * Reconcile an invoice + activate its event after a payment, with elevated
 * privilege. The invoice/event updates are a system consequence of a payment the
 * caller was already authorized to record (requireEdit('accounting') + RLS on
 * the payments insert), and an accounting-only user can lack events-edit RLS —
 * so the cascade runs through the service-role client when available, falling
 * back to the user's client when the service key is absent (local dev).
 */
async function cascadeReconcile(
  authed: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  let cascade: SupabaseClient;
  try {
    cascade = createServiceClient();
  } catch {
    cascade = authed;
  }
  await reconcileInvoiceAndActivateEvent(cascade, invoiceId);
}

export async function recordPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("accounting");

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
    await cascadeReconcile(supabase, data.invoice_id);
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

type InvoiceForLink = {
  id: string;
  invoice_number: string | null;
  total_amount: number | null;
  status: string;
  event_id: string | null;
};

type EnsureLinkResult =
  | { url: string }
  | { error: string; stripeUnconfigured?: boolean };

/**
 * Ensure a Stripe payment link exists for an invoice and return its URL. Reuses
 * a still-active pending link instead of minting duplicates, records the pending
 * payment row on first creation, and issues a draft invoice (draft → sent) since
 * a live link means it's no longer a draft. Shared by the "create link" button
 * and the "email link" action so both behave identically.
 */
async function ensurePaymentLink(
  supabase: SupabaseClient,
  invoice: InvoiceForLink,
): Promise<EnsureLinkResult> {
  if ((invoice.total_amount ?? 0) <= 0) {
    return { error: "Add line items before creating a payment link." };
  }

  try {
    const stripe = getStripe();

    // Idempotency: if a pending Stripe link already exists for this invoice,
    // reuse it rather than minting a duplicate price/link + pending payment row.
    const { data: existing } = await supabase
      .from("payments")
      .select("stripe_payment_link_id")
      .eq("invoice_id", invoice.id)
      .eq("method", "stripe")
      .eq("status", "pending")
      .not("stripe_payment_link_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let url: string | undefined;
    if (existing?.stripe_payment_link_id) {
      const link = await stripe.paymentLinks.retrieve(
        existing.stripe_payment_link_id,
      );
      // A still-active link is reusable; if it was deactivated, fall through.
      if (link.active && link.url) url = link.url;
    }

    if (!url) {
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: Math.round((invoice.total_amount ?? 0) * 100),
        product_data: {
          name: `Invoice ${invoice.invoice_number ?? invoice.id}`,
        },
      });
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_id: invoice.id },
      });

      const user = await getUser();
      await supabase.from("payments").insert({
        invoice_id: invoice.id,
        // Link the payment to the event too, so payment→event is directly
        // traversable without a join (the webhook still reconciles via invoice).
        event_id: invoice.event_id ?? null,
        amount: round2(invoice.total_amount ?? 0),
        currency: "usd",
        method: "stripe",
        status: "pending",
        stripe_payment_link_id: link.id,
        notes: "Stripe payment link",
        created_by: user?.id ?? null,
      });

      url = link.url ?? undefined;
    }

    if (!url) return { error: "Stripe did not return a link URL." };

    // Issue the invoice: a draft invoice with a live payment link is no longer a
    // draft. Without this, reconcile would skip it and a paid link would never
    // mark the invoice paid or activate the event.
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoice.id);
    }

    return { url };
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

export async function createStripePaymentLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("accounting");

  const parsed = StripeLinkSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, status, event_id")
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!invoice) return { error: "Invoice not found." };

  const result = await ensurePaymentLink(supabase, invoice);
  if ("error" in result) {
    return result.stripeUnconfigured
      ? { stripeUnconfigured: true, error: result.error }
      : { error: result.error };
  }

  revalidatePath(`/accounting/invoices/${invoice.id}`);
  return { success: true, url: result.url };
}

/**
 * Create (or reuse) the Stripe payment link for an invoice and EMAIL it to the
 * client — to the linked contact's email, falling back to the company's. Returns
 * an error (not a throw) when there's no email on file or email isn't
 * configured, surfacing the link so the operator can still copy it.
 */
export async function emailStripePaymentLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("accounting");

  const parsed = StripeLinkSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total_amount, status, event_id, contacts(first_name, last_name, email), companies(name, email)",
    )
    .eq("id", parsed.data.invoice_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Invoice not found." };

  type InvoiceRow = InvoiceForLink & {
    contacts: {
      first_name: string;
      last_name: string | null;
      email: string | null;
    } | null;
    companies: { name: string | null; email: string | null } | null;
  };
  const invoice = data as unknown as InvoiceRow;

  const to = invoice.contacts?.email ?? invoice.companies?.email ?? null;
  if (!to) {
    return {
      error:
        "No email on file for this invoice's client. Add an email to the contact (or company) first.",
    };
  }

  const result = await ensurePaymentLink(supabase, {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    status: invoice.status,
    event_id: invoice.event_id,
  });
  if ("error" in result) {
    return result.stripeUnconfigured
      ? { stripeUnconfigured: true, error: result.error }
      : { error: result.error };
  }

  const recipientName =
    [invoice.contacts?.first_name, invoice.contacts?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    invoice.companies?.name ||
    null;
  const amountText =
    invoice.total_amount != null
      ? `$${round2(invoice.total_amount).toFixed(2)}`
      : null;

  const send = await notifyPaymentLink(to, {
    url: result.url,
    invoiceNumber: invoice.invoice_number,
    amountText,
    recipientName,
  });

  if (!send.ok) {
    if (send.skipped) {
      return {
        error:
          "Email isn't configured (RESEND_API_KEY missing), so nothing was sent. The link is ready to copy below.",
        url: result.url,
      };
    }
    return { error: send.error ?? "Could not send the email." };
  }

  revalidatePath(`/accounting/invoices/${invoice.id}`);
  return { success: true, url: result.url, emailedTo: to };
}

/**
 * Email the client their full ITEMIZED invoice: a branded email linking to the
 * public invoice page (/i/<token>, where they pay by card or read the Zelle/wire
 * details) with the invoice PDF attached. Marks a draft invoice sent. Recipient
 * is the linked contact's email, falling back to the company's.
 */
export async function sendInvoiceToClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("accounting");

  const parsed = StripeLinkSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  // Everything after the auth/validation gate runs inside a try so an
  // unexpected throw (PDF render, headers, dynamic import) returns a clean
  // ActionState instead of an uncaught server-action error. (requireEdit's
  // redirect stays above this and propagates as intended.)
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, public_token, invoice_number, total_amount, status, due_date, contacts(first_name, last_name, email), companies(name, email)",
      )
      .eq("id", parsed.data.invoice_id)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Invoice not found." };

    type Row = {
      id: string;
      public_token: string;
      invoice_number: string | null;
      total_amount: number | null;
      status: string;
      due_date: string | null;
      contacts: {
        first_name: string;
        last_name: string | null;
        email: string | null;
      } | null;
      companies: { name: string | null; email: string | null } | null;
    };
    const inv = data as unknown as Row;

    const to = inv.contacts?.email ?? inv.companies?.email ?? null;
    if (!to) {
      return {
        error:
          "No email on file for this invoice's client. Add an email to the contact (or company) first.",
      };
    }

    // Absolute origin from the current request (prod + preview).
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (!host) return { error: "Could not determine the site URL." };
    const url = `${proto}://${host}/i/${inv.public_token}`;

    // Render the PDF from the same loader the public page/PDF use. Dynamic
    // import keeps @react-pdf/renderer out of any client bundle.
    const publicInvoice = await getInvoiceByToken(inv.public_token);
    if (!publicInvoice) return { error: "Could not load the invoice." };
    const { renderInvoicePdf } = await import("@/lib/pdf/invoice-pdf");
    const pdf = await renderInvoicePdf(publicInvoice);

    const recipientName =
      [inv.contacts?.first_name, inv.contacts?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      inv.companies?.name ||
      null;
    const amountText =
      inv.total_amount != null
        ? `$${round2(inv.total_amount).toFixed(2)}`
        : null;
    const dueDateText = inv.due_date ? formatDate(inv.due_date) : null;
    const fileName = `Invoice-${inv.invoice_number ?? inv.id.slice(0, 8)}.pdf`;

    const send = await notifyInvoice(
      to,
      {
        url,
        invoiceNumber: inv.invoice_number,
        amountText,
        dueDateText,
        recipientName,
      },
      [{ filename: fileName, content: pdf }],
    );

    if (!send.ok) {
      if (send.skipped) {
        return {
          error:
            "Email isn't configured (RESEND_API_KEY missing), so nothing was sent. You can still copy the invoice link below.",
          url,
        };
      }
      return { error: send.error ?? "Could not send the invoice email." };
    }

    if (inv.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", inv.id);
    }

    revalidatePath(`/accounting/invoices/${inv.id}`);
    return { success: true, url, emailedTo: to };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not send the invoice.";
    console.error("[invoice] send error:", message);
    return { error: message };
  }
}
