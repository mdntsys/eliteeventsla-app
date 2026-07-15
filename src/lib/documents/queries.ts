import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { utcToPacificInputValue } from "@/lib/time";
import type {
  Document,
  DocumentAudit,
  DocumentRow,
  SowBuilderInitial,
} from "@/lib/documents/types";
import {
  DEFAULT_PACKAGE_NAME,
  DEFAULT_SERVICE_HOURS,
  STANDARD_SETUP_NOTE,
  standardBoothInclusions,
  sowTotal,
  type SowCameraType,
  type SowInclusion,
  type SowPayload,
} from "@/lib/documents/sow";

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

/**
 * Builder pre-fill for a NEW SOW from an event: the event details, the client
 * from the linked contact/company, the Standard Booth Package defaults, and a
 * suggested Total Package Cost seeded from the event's latest non-void invoice.
 * Returns null if the event doesn't exist.
 */
export async function getEventSowDefaults(
  eventId: string,
): Promise<SowBuilderInitial | null> {
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
    .select("id, invoice_line_items(amount)")
    .eq("event_id", eventId)
    .neq("status", "void")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lines = (inv?.invoice_line_items as { amount: number }[] | undefined) ?? [];
  const invoiceTotal = sowTotal(
    lines.map((l) => ({ description: "", quantity: 1, amount: l.amount })),
  );

  const clientName = ev.contacts
    ? [ev.contacts.first_name, ev.contacts.last_name].filter(Boolean).join(" ")
    : "";

  return {
    eventId: ev.id,
    contactId: ev.contact_id,
    companyId: ev.company_id,
    title: `${ev.title} — Statement of Work`,
    eventTitle: ev.title,
    eventDate: ev.event_date ?? "",
    // Seed the datetime-local inputs with Pacific wall-clock values so the SOW
    // start/end pre-fill matches how the team reads the event times.
    startAt: ev.start_at ? utcToPacificInputValue(ev.start_at) : "",
    endAt: ev.end_at ? utcToPacificInputValue(ev.end_at) : "",
    venueName: ev.venue_name ?? "",
    guestCount: ev.guest_count != null ? String(ev.guest_count) : "",
    clientName,
    clientCompany: ev.companies?.name ?? "",
    signerName: clientName,
    signerEmail: ev.contacts?.email ?? "",
    packageName: DEFAULT_PACKAGE_NAME,
    cameraType: "standard",
    serviceHours: String(DEFAULT_SERVICE_HOURS),
    setupNote: STANDARD_SETUP_NOTE,
    inclusions: standardBoothInclusions(),
    total: invoiceTotal ? String(invoiceTotal) : "",
    paymentStructure: "full",
    depositAmount: "",
    notes: "",
  };
}

/**
 * Builder pre-fill for EDITING an existing SOW draft. Returns null unless the
 * document exists, is a customer SOW, and is still a draft (sent/signed SOWs are
 * immutable). start/end are converted back to Pacific for the datetime-local
 * inputs; legacy payloads missing the new fields fall back to package defaults.
 */
export async function getSowForEdit(
  id: string,
): Promise<SowBuilderInitial | null> {
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      "id, kind, status, title, signer_name, signer_email, event_id, contact_id, company_id, payload",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc || doc.kind !== "customer_sow" || doc.status !== "draft") return null;

  const p = (doc.payload ?? {}) as Partial<SowPayload>;
  const camera: SowCameraType =
    p.cameraType === "digital" || p.cameraType === "360"
      ? p.cameraType
      : "standard";
  const inclusions = (p.inclusions ?? []) as SowInclusion[];

  return {
    documentId: doc.id,
    eventId: doc.event_id,
    contactId: doc.contact_id,
    companyId: doc.company_id,
    title: doc.title,
    eventTitle: p.eventTitle ?? "",
    eventDate: p.eventDate ?? "",
    startAt: p.startAt ? utcToPacificInputValue(p.startAt) : "",
    endAt: p.endAt ? utcToPacificInputValue(p.endAt) : "",
    venueName: p.venueName ?? "",
    guestCount: p.guestCount != null ? String(p.guestCount) : "",
    clientName: p.clientName ?? "",
    clientCompany: p.clientCompany ?? "",
    signerName: doc.signer_name ?? "",
    signerEmail: doc.signer_email ?? "",
    packageName: p.packageName ?? DEFAULT_PACKAGE_NAME,
    cameraType: camera,
    serviceHours: p.serviceHours != null ? String(p.serviceHours) : "",
    setupNote: p.setupNote ?? "",
    inclusions: inclusions.length ? inclusions : standardBoothInclusions(),
    total: p.total != null ? String(p.total) : "",
    paymentStructure: p.paymentStructure === "split" ? "split" : "full",
    depositAmount: p.depositAmount != null ? String(p.depositAmount) : "",
    notes: p.notes ?? "",
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
