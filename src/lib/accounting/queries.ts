import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AccountingOverview,
  ContactOption,
  Invoice,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceListRow,
  Option,
  Payment,
  PaymentListRow,
} from "@/lib/accounting/types";

/** Build a contact's display name from its name parts. */
function contactName(
  c: { first_name: string; last_name: string | null } | null,
): string | null {
  if (!c) return null;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

/** Every invoice with its linked contact/company/event names, newest first. */
export async function listInvoices(): Promise<InvoiceListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, contacts(first_name, last_name), companies(name), events(title)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = Invoice & {
    contacts: { first_name: string; last_name: string | null } | null;
    companies: { name: string } | null;
    events: { title: string } | null;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const { contacts, companies, events, ...rest } = row;
    return {
      ...rest,
      contact_name: contactName(contacts),
      company_name: companies?.name ?? null,
      event_title: events?.title ?? null,
    };
  });
}

/**
 * A single invoice with its line items (creation order) and recorded payments
 * (newest first). Returns null if it doesn't exist or isn't visible under RLS.
 */
export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, contacts(first_name, last_name), companies(name), events(title)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  type Row = Invoice & {
    contacts: { first_name: string; last_name: string | null } | null;
    companies: { name: string } | null;
    events: { title: string } | null;
  };
  const { contacts, companies, events, ...invoice } = data as Row;

  const [{ data: items, error: itemsError }, { data: pays, error: paysError }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (itemsError) throw new Error(itemsError.message);
  if (paysError) throw new Error(paysError.message);

  return {
    ...invoice,
    contact_name: contactName(contacts),
    company_name: companies?.name ?? null,
    event_title: events?.title ?? null,
    line_items: (items ?? []) as InvoiceLineItem[],
    payments: (pays ?? []) as Payment[],
  };
}

/** Every payment with its invoice number + event title, newest first. */
export async function listPayments(): Promise<PaymentListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, invoices(invoice_number), events(title)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = Payment & {
    invoices: { invoice_number: string | null } | null;
    events: { title: string } | null;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const { invoices, events, ...rest } = row;
    return {
      ...rest,
      invoice_number: invoices?.invoice_number ?? null,
      event_title: events?.title ?? null,
    };
  });
}

/** Headline money figures for the accounting overview. Aggregated in JS. */
export async function accountingOverview(): Promise<AccountingOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("status, total_amount, amount_paid, due_date");
  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  let outstanding = 0;
  let paidTotal = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let draftCount = 0;
  let openCount = 0;

  for (const inv of data ?? []) {
    const total = inv.total_amount ?? 0;
    const paid = inv.amount_paid ?? 0;
    const balance = Math.max(total - paid, 0);

    if (inv.status === "draft") {
      draftCount += 1;
      continue;
    }
    if (inv.status === "void") continue;

    // Collected = money on real (issued, non-void) invoices only — a voided or
    // still-draft invoice's amount_paid must not inflate the headline figure.
    paidTotal += paid;

    if (inv.status === "paid") continue;

    // sent / partial / overdue still owe money.
    outstanding += balance;
    openCount += 1;
    const isOverdue =
      inv.status === "overdue" ||
      (inv.due_date != null && inv.due_date < today && balance > 0);
    if (isOverdue) {
      overdueAmount += balance;
      overdueCount += 1;
    }
  }

  // Recent payments = real cash in: a pending/failed Stripe attempt shouldn't
  // read as a payment on the overview. The full list lives on /accounting/payments.
  const recentPayments = (await listPayments())
    .filter((p) => p.status === "succeeded")
    .slice(0, 6);

  return {
    outstanding,
    paidTotal,
    overdueAmount,
    overdueCount,
    draftCount,
    openCount,
    invoiceCount: (data ?? []).length,
    recentPayments,
  };
}

// --- Option lists for form selects ------------------------------------------

export async function listEventOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ id: e.id, label: e.title }));
}

export async function listContactOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    label: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Unnamed",
  }));
}

/**
 * Contacts with their linked company, so the invoice form can auto-derive the
 * company once a contact is chosen (no separate, error-prone company picker).
 */
export async function listContactOptionsWithCompany(): Promise<ContactOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company_id, companies(name)")
    .order("first_name", { ascending: true });
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    first_name: string;
    last_name: string | null;
    company_id: string | null;
    companies: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((c) => ({
    id: c.id,
    label:
      [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Unnamed",
    company_id: c.company_id ?? null,
    company_name: c.companies?.name ?? null,
  }));
}

export async function listCompanyOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, label: c.name }));
}

/** Open invoices as options for reconciling a standalone payment. */
export async function listInvoiceOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total_amount, status")
    .neq("status", "void")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((i) => ({
    id: i.id,
    label: i.invoice_number ?? `Invoice ${i.id.slice(0, 8)}`,
  }));
}
