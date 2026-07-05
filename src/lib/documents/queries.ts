import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  Document,
  DocumentAudit,
  DocumentRow,
} from "@/lib/documents/types";

/**
 * Server-only data access for documents. Staff (documents area) see all; an
 * affiliate sees only their own (owner-scoped select policy). Signed PDFs live
 * in a private bucket — read them via a short-lived signed URL.
 */

type Embeds = {
  affiliates: { profiles: { full_name: string | null } | null } | null;
  events: { title: string | null } | null;
};

function lift(d: Document & Embeds): DocumentRow {
  const { affiliates, events, ...rest } = d;
  return {
    ...rest,
    affiliate_name: affiliates?.profiles?.full_name ?? null,
    event_title: events?.title ?? null,
  };
}

const SELECT =
  "*, affiliates(profiles!affiliates_profile_id_fkey(full_name)), events(title)";

/** Every document with subject names, newest first (staff list). */
export async function listDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => lift(d as unknown as Document & Embeds));
}

/** A single document (or null). */
export async function getDocument(id: string): Promise<DocumentRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return lift(data as unknown as Document & Embeds);
}

/** The append-only audit trail for a document, oldest first. */
export async function listDocumentAudit(
  documentId: string,
): Promise<DocumentAudit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_audit")
    .select("*")
    .eq("document_id", documentId)
    .order("at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The current affiliate's own documents (portal), newest first. */
export async function getMyDocuments(): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SowDefaults = {
  title: string;
  event_id: string;
  contact_id: string | null;
  company_id: string | null;
  signer_name: string;
  signer_email: string;
  event_title: string;
  event_date: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  guest_count: number | null;
  client_name: string;
  client_company: string;
  scope_items: { description: string; quantity: number; amount: number }[];
};

/**
 * Pre-fill values for a new SOW from an event: its details + the agreed scope
 * seeded from the event's latest non-void invoice line items + the client from
 * the linked contact/company. Returns null if the event doesn't exist.
 */
export async function getEventSowDefaults(
  eventId: string,
): Promise<SowDefaults | null> {
  const supabase = await createClient();

  const { data: evRow } = await supabase
    .from("events")
    .select(
      "id, title, event_date, start_at, end_at, venue_name, guest_count, contact_id, company_id, contacts(first_name, last_name, email), companies(name)",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!evRow) return null;
  const ev = evRow as typeof evRow & {
    contacts: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
    companies: { name: string | null } | null;
  };

  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_line_items(description, quantity, amount)")
    .eq("event_id", eventId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lines =
    (inv?.invoice_line_items as
      | { description: string; quantity: number; amount: number }[]
      | undefined) ?? [];

  const clientName = ev.contacts
    ? [ev.contacts.first_name, ev.contacts.last_name].filter(Boolean).join(" ")
    : "";

  return {
    title: `${ev.title} — Statement of Work`,
    event_id: ev.id,
    contact_id: ev.contact_id,
    company_id: ev.company_id,
    signer_name: clientName,
    signer_email: ev.contacts?.email ?? "",
    event_title: ev.title,
    event_date: ev.event_date,
    start_at: ev.start_at,
    end_at: ev.end_at,
    venue_name: ev.venue_name,
    guest_count: ev.guest_count,
    client_name: clientName,
    client_company: ev.companies?.name ?? "",
    scope_items: lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      amount: l.amount,
    })),
  };
}

/**
 * A short-lived signed URL for a document's stored (executed) PDF, or null.
 * Uses the service-role client so it works for both staff and the affiliate
 * portal (each already scoped to a document they're allowed to see).
 */
export async function getSignedDocumentUrl(
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null;
  const db = createServiceClient();
  const { data } = await db.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
