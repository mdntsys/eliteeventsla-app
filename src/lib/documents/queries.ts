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
