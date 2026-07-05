import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];

export type Document = Tables["documents"]["Row"];
export type DocumentAudit = Tables["document_audit"]["Row"];
export type DocumentKind = Database["public"]["Enums"]["document_kind"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];

export type ActionState =
  | { error?: string; success?: boolean; notice?: string }
  | undefined;

/** A document joined to its subject's display names, for internal lists. */
export type DocumentRow = Document & {
  affiliate_name: string | null;
  event_title: string | null;
};

/** The narrow, no-login view of a document rendered on the public signing page. */
export type PublicDocument = {
  id: string;
  kind: DocumentKind;
  title: string;
  status: DocumentStatus;
  signer_name: string | null;
  signer_email: string | null;
  payload: unknown;
  token_expires_at: string | null;
  /** Computed in the loader (keeps Date.now() out of the render path). */
  token_expired: boolean;
  signed_at: string | null;
};
