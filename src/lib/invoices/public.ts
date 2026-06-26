import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Client-facing invoice data, loaded by the invoice's public token. Backs the
 * public surfaces — the /i/<token> page, its PDF, and its checkout. There is no
 * user session on these surfaces, so reads go through the service-role client;
 * EVERY read is scoped to the one token, so no other invoice is reachable.
 *
 * Security note: never widen this beyond client-appropriate fields. The token
 * is the bearer credential for exactly one invoice.
 */

export type PublicInvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type PublicInvoice = {
  id: string;
  public_token: string;
  invoice_number: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  issued_date: string | null;
  due_date: string | null;
  notes: string | null;
  event_id: string | null;
  client_name: string | null;
  client_email: string | null;
  company_name: string | null;
  line_items: PublicInvoiceLine[];
};

type InvoiceRow = {
  id: string;
  public_token: string;
  invoice_number: string | null;
  status: string;
  subtotal: number | null;
  tax: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  issued_date: string | null;
  due_date: string | null;
  notes: string | null;
  event_id: string | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    email: string | null;
  } | null;
  companies: { name: string | null; email: string | null } | null;
};

/** Load one invoice by its public token, or null for an unknown/short token. */
export async function getInvoiceByToken(
  token: string,
): Promise<PublicInvoice | null> {
  // Tokens are 64 hex chars; reject obviously-invalid input before any query.
  if (!token || token.length < 32 || !/^[a-f0-9]+$/i.test(token)) return null;

  const db = createServiceClient();

  const { data, error } = await db
    .from("invoices")
    .select(
      "id, public_token, invoice_number, status, subtotal, tax, total_amount, amount_paid, issued_date, due_date, notes, event_id, contacts(first_name, last_name, email), companies(name, email)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error || !data) return null;
  // PostgREST returns to-one embeds (contacts/companies) as single objects at
  // runtime; the untyped client mis-infers them as arrays, hence the cast.
  const inv = data as unknown as InvoiceRow;

  const { data: lineRows } = await db
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price, amount")
    .eq("invoice_id", inv.id)
    .order("created_at", { ascending: true });

  const total = Number(inv.total_amount ?? 0);
  const paid = Number(inv.amount_paid ?? 0);
  const clientName = inv.contacts
    ? [inv.contacts.first_name, inv.contacts.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || null
    : null;

  const line_items: PublicInvoiceLine[] = (
    (lineRows ?? []) as {
      id: string;
      description: string;
      quantity: number | null;
      unit_price: number | null;
      amount: number | null;
    }[]
  ).map((l) => ({
    id: l.id,
    description: l.description,
    quantity: Number(l.quantity ?? 0),
    unit_price: Number(l.unit_price ?? 0),
    amount: Number(l.amount ?? 0),
  }));

  return {
    id: inv.id,
    public_token: inv.public_token,
    invoice_number: inv.invoice_number,
    status: inv.status,
    subtotal: Number(inv.subtotal ?? 0),
    tax: Number(inv.tax ?? 0),
    total_amount: total,
    amount_paid: paid,
    balance: Math.max(total - paid, 0),
    issued_date: inv.issued_date,
    due_date: inv.due_date,
    notes: inv.notes,
    event_id: inv.event_id,
    client_name: clientName,
    client_email: inv.contacts?.email ?? null,
    company_name: inv.companies?.name ?? null,
    line_items,
  };
}
