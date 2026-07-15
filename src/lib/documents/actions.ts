"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import {
  sowCanonicalText,
  standardBoothInclusions,
  DEFAULT_PACKAGE_NAME,
  type SowPayload,
  type SowInclusion,
} from "@/lib/documents/sow";
import {
  optionalUuid,
  optionalText,
  optionalDate,
  optionalPacificDateTime,
  optionalInt,
  optionalMoney,
} from "@/lib/forms/coercions";
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

/**
 * Prepare the CURRENT affiliate's commission agreement for in-portal signing:
 * find (or lazily create) their contract document and ensure it has a live
 * token. Derives the affiliate strictly from the caller's own session (never a
 * passed id) and runs via the service-role client (an affiliate can't mint a
 * token on the documents table themselves). Returns null if the caller is not an
 * affiliate.
 */
export async function prepareMyContractForSigning(): Promise<{
  signed: boolean;
  documentId: string;
  token: string | null;
  title: string;
  payload: unknown;
} | null> {
  const user = await getUser();
  if (!user) return null;

  let db: ReturnType<typeof createServiceClient>;
  try {
    db = createServiceClient();
  } catch {
    return null;
  }

  const { data: affRow } = await db
    .from("affiliates")
    .select(
      "id, commission_rate, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .eq("profile_id", user.id)
    .maybeSingle();
  const aff = affRow as unknown as {
    id: string;
    commission_rate: number;
    profiles: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
  if (!aff) return null;

  const cols =
    "id, status, title, payload, sign_token, token_expires_at";
  let { data: doc } = await db
    .from("documents")
    .select(cols)
    .eq("affiliate_id", aff.id)
    .eq("kind", "affiliate_contract")
    .neq("status", "voided")
    .limit(1)
    .maybeSingle();

  if (!doc) {
    const payload = buildAffiliateContractPayload({
      full_name: aff.profiles?.full_name ?? null,
      email: aff.profiles?.email ?? null,
      phone: aff.profiles?.phone ?? null,
      commission_rate: aff.commission_rate,
    });
    const { data: created } = await db
      .from("documents")
      .insert({
        kind: "affiliate_contract",
        title: `${payload.companyName} — Sales Commission Agreement`,
        status: "draft",
        affiliate_id: aff.id,
        signer_name: payload.representativeName,
        signer_email: payload.email,
        payload,
        created_by: user.id,
      })
      .select(cols)
      .single();
    doc = created;
    if (doc) {
      await db
        .from("document_audit")
        .insert({ document_id: doc.id, event: "created", actor: user.email ?? "system" });
    }
  }
  if (!doc) return null;

  if (doc.status === "signed") {
    return {
      signed: true,
      documentId: doc.id,
      token: null,
      title: doc.title,
      payload: doc.payload,
    };
  }

  let token = doc.sign_token;
  const expired =
    !!doc.token_expires_at &&
    new Date(doc.token_expires_at).getTime() < Date.now();
  if (!token || expired) {
    token = newToken();
    await db
      .from("documents")
      .update({
        sign_token: token,
        token_expires_at: new Date(
          Date.now() + TOKEN_TTL_DAYS * 86_400_000,
        ).toISOString(),
        status: doc.status === "draft" ? "sent" : doc.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
  }

  return {
    signed: false,
    documentId: doc.id,
    token,
    title: doc.title,
    payload: doc.payload,
  };
}

const InclusionSchema = z.object({
  label: z.string().trim().min(1),
  detail: z.string().trim().default(""),
});

/** Payment structure: anything that isn't an explicit "split" is "full". */
const paymentStructureSchema = z.preprocess(
  (v) => (v === "split" ? "split" : "full"),
  z.enum(["full", "split"]),
);

const SowFormSchema = z.object({
  title: z.string().trim().min(1, "A title is required."),
  event_id: optionalUuid,
  contact_id: optionalUuid,
  company_id: optionalUuid,
  signer_name: optionalText,
  signer_email: optionalText,
  // #1
  event_title: z.string().trim().min(1, "An event title is required."),
  event_date: optionalDate,
  start_at: optionalPacificDateTime,
  end_at: optionalPacificDateTime,
  venue_name: optionalText,
  guest_count: optionalInt,
  client_name: optionalText,
  client_company: optionalText,
  // #2
  package_name: optionalText,
  camera_type: z.preprocess(
    (v) => (v === "digital" || v === "360" ? v : v === "standard" ? "standard" : null),
    z.enum(["standard", "digital", "360"]).nullable(),
  ),
  service_hours: optionalInt,
  setup_note: optionalText,
  // #3
  total: optionalMoney,
  payment_structure: paymentStructureSchema,
  deposit_amount: optionalMoney,
  notes: optionalText,
});

type SowFormData = z.infer<typeof SowFormSchema>;

/** Pull the SOW builder fields out of a submitted form (shared create/update). */
function sowFieldsFrom(formData: FormData) {
  return {
    title: formData.get("title"),
    event_id: formData.get("event_id"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    signer_name: formData.get("signer_name"),
    signer_email: formData.get("signer_email"),
    event_title: formData.get("event_title"),
    event_date: formData.get("event_date"),
    start_at: formData.get("start_at"),
    end_at: formData.get("end_at"),
    venue_name: formData.get("venue_name"),
    guest_count: formData.get("guest_count"),
    client_name: formData.get("client_name"),
    client_company: formData.get("client_company"),
    package_name: formData.get("package_name"),
    camera_type: formData.get("camera_type"),
    service_hours: formData.get("service_hours"),
    setup_note: formData.get("setup_note"),
    total: formData.get("total"),
    payment_structure: formData.get("payment_structure"),
    deposit_amount: formData.get("deposit_amount"),
    notes: formData.get("notes"),
  };
}

/** Parse the inclusions JSON hidden field; null on malformed input. */
function parseInclusions(raw: FormDataEntryValue | null): SowInclusion[] | null {
  let value: unknown;
  try {
    value = JSON.parse(String(raw ?? "[]"));
  } catch {
    return null;
  }
  const res = z.array(InclusionSchema).safeParse(value);
  if (!res.success) return null;
  return res.data
    .map((i) => ({ label: i.label.trim(), detail: i.detail.trim() }))
    .filter((i) => i.label !== "");
}

/** Assemble the immutable SOW payload snapshot from validated form data. */
function buildSowPayload(
  data: SowFormData,
  inclusions: SowInclusion[],
): SowPayload {
  return {
    companyName: "Elite Events LA",
    eventTitle: data.event_title,
    eventDate: data.event_date,
    startAt: data.start_at,
    endAt: data.end_at,
    venueName: data.venue_name,
    guestCount: data.guest_count,
    clientName: data.client_name,
    clientCompany: data.client_company,
    packageName: data.package_name ?? DEFAULT_PACKAGE_NAME,
    cameraType: data.camera_type,
    serviceHours: data.service_hours,
    inclusions,
    setupNote: data.setup_note,
    total: data.total ?? 0,
    paymentStructure: data.payment_structure,
    depositAmount: data.deposit_amount,
    mediaRelease: null,
    notes: data.notes,
  };
}

/**
 * Create a customer Statement of Work from the builder form. Snapshots the event
 * details, package inclusions, and pricing into the document payload as a DRAFT,
 * then redirects to the document where the team previews and sends it. The client
 * makes the media-release election at signing (payload.mediaRelease starts null).
 */
export async function createSow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("documents");

  const parsed = SowFormSchema.safeParse(sowFieldsFrom(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const inclusions = parseInclusions(formData.get("inclusions"));
  if (inclusions == null) return { error: "Each inclusion needs a label." };
  const finalInclusions = inclusions.length
    ? inclusions
    : standardBoothInclusions();

  const data = parsed.data;
  const payload = buildSowPayload(data, finalInclusions);

  const user = await getUser();
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      kind: "customer_sow",
      title: data.title,
      status: "draft",
      event_id: data.event_id,
      contact_id: data.contact_id,
      company_id: data.company_id,
      signer_name: data.signer_name,
      signer_email: data.signer_email,
      payload,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !doc) {
    return { error: error?.message ?? "Could not create the SOW." };
  }

  await supabase.from("document_audit").insert({
    document_id: doc.id,
    event: "created",
    actor: user?.email ?? "system",
  });

  revalidatePath("/documents");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/documents/${doc.id}`);
}

const UpdateSowSchema = SowFormSchema.extend({
  id: z.uuid("A document is required."),
});

/**
 * Edit a DRAFT customer SOW in place (re-snapshot its payload). Only drafts are
 * editable — a sent or signed SOW is immutable, so it must be voided and
 * recreated to change. Redirects back to the document on success.
 */
export async function updateSow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("documents");

  const parsed = UpdateSowSchema.safeParse({
    id: formData.get("id"),
    ...sowFieldsFrom(formData),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const inclusions = parseInclusions(formData.get("inclusions"));
  if (inclusions == null) return { error: "Each inclusion needs a label." };
  const finalInclusions = inclusions.length
    ? inclusions
    : standardBoothInclusions();

  const data = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("documents")
    .select("id, kind, status")
    .eq("id", data.id)
    .maybeSingle();
  if (!existing) return { error: "Document not found." };
  if (existing.kind !== "customer_sow") {
    return { error: "That document isn't a statement of work." };
  }
  if (existing.status !== "draft") {
    return {
      error:
        "Only a draft SOW can be edited. Void this one and create a new SOW to change a document that's already been sent.",
    };
  }

  const payload = buildSowPayload(data, finalInclusions);
  const { error } = await supabase
    .from("documents")
    .update({
      title: data.title,
      event_id: data.event_id,
      contact_id: data.contact_id,
      company_id: data.company_id,
      signer_name: data.signer_name,
      signer_email: data.signer_email,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (error) return { error: error.message };

  const user = await getUser();
  await supabase.from("document_audit").insert({
    document_id: data.id,
    event: "edited",
    actor: user?.email ?? "system",
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${data.id}`);
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/documents/${data.id}`);
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

  // The SOW media-release election (#5) is made by the client here, at signing.
  let sowMediaConsent: boolean | null = null;

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
    } else if (doc.kind === "customer_sow") {
      // The client must elect their media-release preference to sign a SOW (#5).
      const mediaRaw = String(formData.get("media_release") ?? "");
      if (mediaRaw !== "yes" && mediaRaw !== "no") {
        return {
          error: "Please choose Yes or No for the media release before signing.",
        };
      }
      sowMediaConsent = mediaRaw === "yes";
      const payload: SowPayload = {
        ...(doc.payload as SowPayload),
        mediaRelease: sowMediaConsent,
      };
      const contentHash = createHash("sha256")
        .update(sowCanonicalText(payload))
        .digest("hex");
      const { renderSowPdf } = await import("@/lib/pdf/sow-pdf");
      const pdf = await renderSowPdf(payload, {
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

  // Denormalize the client's media-release election onto their contact profile so
  // sales/ops see the standing preference and onsite crew know whether they may
  // capture and share images. Written via the token-scoped service-role client.
  if (doc.kind === "customer_sow" && doc.contact_id && sowMediaConsent !== null) {
    await db
      .from("contacts")
      .update({
        media_release_consent: sowMediaConsent,
        media_release_recorded_at: signedAt,
        media_release_document_id: doc.id,
      })
      .eq("id", doc.contact_id);
    revalidatePath(`/crm/contacts/${doc.contact_id}`);
    revalidatePath("/operations/scheduling");
    if (doc.event_id) revalidatePath(`/events/${doc.event_id}`);
  }

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
