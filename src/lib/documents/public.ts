import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { PublicDocument } from "@/lib/documents/types";

/**
 * Load a document by its signing token for the PUBLIC (no-login) signing page.
 * Mirrors the invoice public-token pattern: validate the token shape, read via
 * the service-role client scoped strictly to one token, and return only
 * client-safe fields. Never add an anon RLS policy to `documents`.
 */
export async function getDocumentByToken(
  token: string,
): Promise<PublicDocument | null> {
  // Token is two concatenated uuids (hex) — cheap shape guard before querying.
  if (!token || token.length < 32 || !/^[a-f0-9]+$/i.test(token)) {
    return null;
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("documents")
    .select(
      "id, kind, title, status, signer_name, signer_email, payload, token_expires_at, signed_at",
    )
    .eq("sign_token", token)
    .maybeSingle();

  if (error || !data) return null;
  const token_expired =
    !!data.token_expires_at &&
    new Date(data.token_expires_at).getTime() < Date.now();
  return { ...data, token_expired } as PublicDocument;
}
