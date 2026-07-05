"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, requireEdit } from "@/lib/auth/dal";
import { sendEmail } from "@/lib/email/send";
import { signatureRequestEmail } from "@/lib/email/templates";
import {
  buildAffiliateContractPayload,
  affiliateContractCanonicalText,
  type ContractPayload,
} from "@/lib/documents/contract";
import type { ActionState } from "@/lib/documents/types";

/**
 * Documents / e-signature server actions. Staff actions gate on
 * requireEdit("documents"). The public signDocument action takes NO session —
 * it authenticates via the unguessable, expiring, single-use token and runs
 * through the service-role client, strictly scoped to that one token.
 */

const TOKEN_TTL_DAYS = 30;

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** 64 hex chars (two uuids) — matches the /^[a-f0-9]+$/ public-token guard. */
function newToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

/**
 * Create (or return the existing) affiliate contract document for an affiliate.
 * Called from createAffiliate and lazily from the portal gate. Idempotent.
 */
export async function createAffiliateContract(
  affiliateId: string,
): Promise<{ id: string } | null> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("kind", "affiliate_contract")
    .neq("status", "voided")
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data: affRow } = await supabase
    .from("affiliates")
    .select(
      "id, commission_rate, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .eq("id", affiliateId)
    .maybeSingle();
  const aff = affRow as unknown as {
    commission_rate: number;
    profiles: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
  if (!aff) return null;

  const payload = buildAffiliateContractPayload({
    full_name: aff.profiles?.full_name ?? null,
    email: aff.profiles?.email ?? null,
    phone: aff.profiles?.phone ?? null,
    commission_rate: aff.commission_rate,
  });

  const user = await getUser();
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      kind: "affiliate_contract",
      title: `${payload.companyName} — Sales Commission Agreement`,
      status: "draft",
      affiliate_id: affiliateId,
      signer_name: payload.representativeName,
      signer_email: payload.email,
      payload,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !doc) return null;

  await supabase.from("document_audit").insert({
    document_id: doc.id,
    event: "created",
    actor: user?.email ?? "system",
  });

  return { id: doc.id };
}

const IdSchema = z.object({ id: z.uuid("A document is required.") });

/**
 * Issue a document for signature: mint an expiring token, mark it 'sent', log an
 * audit entry, and email the signer a signing link. Returns the link for manual
 * sharing when email is off.
 */
export async function sendDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("documents");

  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: doc, error: loadErr } = await supabase
    .from("documents")
    .select("id, title, status, signer_email, signer_name")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!doc) return { error: "Document not found." };
  if (doc.status === "signed") return { error: "That document is already signed." };

  const token = newToken();
  const expires = new Date(
    Date.now() + TOKEN_TTL_DAYS * 86_400_000,
  ).toISOString();

  const { error: upErr } = await supabase
    .from("documents")
    .update({
      status: "sent",
      sign_token: token,
      token_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);
  if (upErr) return { error: upErr.message };

  const user = await getUser();
  await supabase.from("document_audit").insert({
    document_id: doc.id,
    event: "sent",
    actor: user?.email ?? "system",
  });

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "app.eliteeventsla.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const signUrl = `${proto}://${host}/sign/${token}`;

  revalidatePath("/documents");
  revalidatePath(`/documents/${doc.id}`);

  if (!doc.signer_email) {
    return {
      success: true,
      notice: `Signing link created (no email on file — share it manually): ${signUrl}`,
    };
  }

  const sent = await sendEmail({
    to: doc.signer_email,
    ...signatureRequestEmail({
      recipientName: doc.signer_name,
      documentTitle: doc.title,
      signUrl,
    }),
  });
  if (sent.skipped || !sent.ok) {
    return {
      success: true,
      notice: `Marked sent. Email is off/failed — share this signing link: ${signUrl}`,
    };
  }
  return {
    success: true,
    notice: `Sent to ${doc.signer_email} for signature.`,
  };
}

/** Void a document — it can no longer be signed; the token is cleared. */
export async function voidDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("documents");

  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (doc?.status === "signed") {
    return { error: "A signed document can't be voided." };
  }

  const { error } = await supabase
    .from("documents")
    .update({
      status: "voided",
      sign_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  const user = await getUser();
  await supabase.from("document_audit").insert({
    document_id: parsed.data.id,
    event: "voided",
    actor: user?.email ?? "system",
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${parsed.data.id}`);
  return { success: true };
}

/**
 * PUBLIC signing action — no session. Authenticated solely by the unguessable
 * token. Validates the token + consent, captures the signature and a
 * tamper-evident audit trail (IP, user-agent, UTC time, content hash), renders
 * the executed PDF into the private bucket, marks the document signed, and
 * invalidates the token (single-use). Runs through the service-role client
 * scoped strictly to the one token.
 */
export async function signDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const consent = formData.get("consent");
  const signatureName = String(formData.get("signature_name") ?? "").trim();

  if (!/^[a-f0-9]{32,}$/i.test(token)) {
    return { error: "Invalid signing link." };
  }
  if (consent !== "on" && consent !== "true") {
    return { error: "Please check the box to agree to sign electronically." };
  }
  if (signatureName === "") {
    return { error: "Type your name to adopt your signature." };
  }

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return { error: "Signing is temporarily unavailable." };
  }

  const { data: doc } = await db
    .from("documents")
    .select("*")
    .eq("sign_token", token)
    .maybeSingle();
  if (!doc) return { error: "This signing link is invalid or has expired." };
  if (doc.status === "signed") {
    return { error: "This document has already been signed." };
  }
  if (doc.status === "voided") {
    return { error: "This document is no longer available to sign." };
  }
  if (
    doc.token_expires_at &&
    new Date(doc.token_expires_at).getTime() < Date.now()
  ) {
    return { error: "This signing link has expired. Please request a new one." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const userAgent = h.get("user-agent") ?? null;
  const signedAt = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status: "signed",
    signed_at: signedAt,
    signer_ip: ip,
    signer_user_agent: userAgent,
    signature_name: signatureName,
    sign_token: null,
    token_expires_at: null,
    updated_at: signedAt,
  };

  try {
    if (doc.kind === "affiliate_contract") {
      const payload: ContractPayload = {
        ...(doc.payload as ContractPayload),
        effectiveDate: signedAt.slice(0, 10),
      };
      const contentHash = createHash("sha256")
        .update(affiliateContractCanonicalText(payload))
        .digest("hex");
      const { renderAffiliateContractPdf } = await import(
        "@/lib/pdf/contract-pdf"
      );
      const pdf = await renderAffiliateContractPdf(payload, {
        documentId: doc.id,
        name: signatureName,
        email: doc.signer_email,
        signedAt,
        ip,
        userAgent,
        contentHash,
      });
      const storagePath = `${doc.id}/signed.pdf`;
      const { error: upErr } = await db.storage
        .from("documents")
        .upload(storagePath, pdf, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) return { error: "Could not store the signed document." };
      updates.payload = payload;
      updates.content_hash = contentHash;
      updates.storage_path = storagePath;
    } else {
      // Other kinds (customer SOW is rendered in a later phase): still capture a
      // fingerprint of the exact payload signed.
      updates.content_hash = createHash("sha256")
        .update(JSON.stringify(doc.payload ?? {}))
        .digest("hex");
    }
  } catch (e) {
    console.error("[sign] render/store failed:", e);
    return { error: "Could not finalize the signed document." };
  }

  const { error } = await db
    .from("documents")
    .update(updates)
    .eq("id", doc.id);
  if (error) return { error: error.message };

  await db.from("document_audit").insert({
    document_id: doc.id,
    event: "signed",
    actor: doc.signer_email ?? signatureName,
    ip,
    user_agent: userAgent,
    meta: {
      signature_name: signatureName,
      content_hash: updates.content_hash ?? null,
    },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${doc.id}`);
  return { success: true };
}

/** Record that a signer opened the document (viewed), from the public page. */
export async function markDocumentViewed(token: string): Promise<void> {
  if (!/^[a-f0-9]{32,}$/i.test(token)) return;
  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return;
  }
  const { data: doc } = await db
    .from("documents")
    .select("id, status")
    .eq("sign_token", token)
    .maybeSingle();
  if (!doc || doc.status === "signed" || doc.status === "voided") return;
  if (doc.status !== "viewed") {
    await db
      .from("documents")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", doc.id);
    await db
      .from("document_audit")
      .insert({ document_id: doc.id, event: "viewed" });
  }
}
