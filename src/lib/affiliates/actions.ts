"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, requireEdit, requireSuperAdmin } from "@/lib/auth/dal";
import { sendEmail } from "@/lib/email/send";
import { affiliateWelcomeEmail } from "@/lib/email/templates";
import { createAffiliateContract } from "@/lib/documents/actions";
import { resyncEventAffiliateCommissions } from "@/lib/accounting/reconcile";
import { optionalText, optionalDate, optionalUuid } from "@/lib/forms/coercions";
import type { ActionState } from "@/lib/affiliates/types";

/**
 * Server actions for the affiliates module. Writes gate on
 * requireEdit("affiliates") (Sales + Admin + super-admin) alongside RLS.
 * Provisioning mirrors admin/inviteUser: the SERVICE-ROLE client creates the
 * auth user (public signup is disabled), and the profile-creation trigger sets
 * role='affiliate' + name/phone from metadata (see migration 0028), so no
 * privilege-gated profile UPDATE is needed. The optional EIN lands in the
 * super-admin-only affiliate_private table via the service client.
 */

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** Percent (0–100) → stored fraction (0–1), rounded to 4dp. */
function pctToRate(pct: number): number {
  return Math.round((pct / 100 + Number.EPSILON) * 10000) / 10000;
}

/** Round to cents to avoid float drift when summing money. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const CreateAffiliateSchema = z.object({
  full_name: z.string().trim().min(1, "A name is required."),
  email: z.email("Enter a valid email."),
  phone: optionalText,
  commission_pct: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, {
      message: "Commission must be between 0 and 100%.",
    }),
  ein: optionalText,
  notes: optionalText,
});

export async function createAffiliate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("affiliates");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to create affiliate logins." };
  }

  const parsed = CreateAffiliateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    commission_pct: formData.get("commission_pct"),
    ein: formData.get("ein"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { full_name, email, phone, commission_pct, ein, notes } = parsed.data;

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to create affiliate logins." };
  }

  // Create the login. The trigger (0028) creates the profile with role=affiliate
  // + name/phone from this metadata (only 'affiliate' is honored from metadata).
  const tempPassword = "Elite2026!" + randomBytes(4).toString("hex");
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: "affiliate",
      ...(phone ? { phone } : {}),
    },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return {
      error: exists ? "That email already has an account." : error.message,
    };
  }
  const profileId = created?.user?.id;
  if (!profileId) return { error: "Could not create the affiliate login." };

  const user = await getUser();
  const supabase = await createClient();

  // Affiliate record (RLS: affiliates-edit). Rate stored as a 0–1 fraction.
  const { data: affiliate, error: affErr } = await supabase
    .from("affiliates")
    .insert({
      profile_id: profileId,
      commission_rate: pctToRate(commission_pct),
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (affErr || !affiliate) {
    return { error: affErr?.message ?? "Could not create the affiliate record." };
  }

  // Optional EIN → isolated, super-admin-only store (written via service role).
  if (ein) {
    await service
      .from("affiliate_private")
      .insert({ affiliate_id: affiliate.id, ein });
  }

  // Draft their commission agreement so it's ready to sign on first login.
  await createAffiliateContract(affiliate.id);

  // Welcome email (temp password + sign-in link).
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "app.eliteeventsla.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const sent = await sendEmail({
    to: email,
    ...affiliateWelcomeEmail({
      fullName: full_name,
      email,
      tempPassword,
      signInUrl: `${proto}://${host}/login`,
      commissionPct: commission_pct,
    }),
  });

  revalidatePath("/affiliates");

  if (sent.skipped) {
    return {
      success: true,
      notice: `Created affiliate ${email}. Email is off (no RESEND_API_KEY) — temporary password: ${tempPassword}`,
    };
  }
  if (!sent.ok) {
    return {
      success: true,
      notice: `Created affiliate ${email}, but the welcome email failed (${sent.error ?? "unknown"}). Share this temporary password manually: ${tempPassword}`,
    };
  }
  return {
    success: true,
    notice: `Created affiliate ${email} — a welcome email with their login was sent.`,
  };
}

const UpdateAffiliateSchema = z.object({
  id: z.uuid("An affiliate is required."),
  commission_pct: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 100, {
      message: "Commission must be between 0 and 100%.",
    }),
  status: z.enum(["active", "inactive"]),
  notes: optionalText,
});

/** Update an affiliate's commission rate, status, and notes (staff only). */
export async function updateAffiliate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("affiliates");

  const parsed = UpdateAffiliateSchema.safeParse({
    id: formData.get("id"),
    commission_pct: formData.get("commission_pct"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { id, commission_pct, status, notes } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("affiliates")
    .update({
      commission_rate: pctToRate(commission_pct),
      status,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/affiliates/${id}`);
  revalidatePath("/affiliates");
  return { success: true };
}

const RecordPayoutSchema = z.object({
  affiliate_id: z.uuid("An affiliate is required."),
  method: optionalText,
  reference: optionalText,
  paid_at: optionalDate,
  notes: optionalText,
});

/**
 * Record a payout covering ALL of an affiliate's currently-accrued commissions:
 * insert a payout row for their sum and mark those commissions 'paid' (linked to
 * the payout). No funds move — this is the ledger of what was paid. The status
 * guard on the update makes it safe against a concurrent double-submit.
 */
export async function recordPayout(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("affiliates");

  const parsed = RecordPayoutSchema.safeParse({
    affiliate_id: formData.get("affiliate_id"),
    method: formData.get("method"),
    reference: formData.get("reference"),
    paid_at: formData.get("paid_at"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { affiliate_id, method, reference, paid_at, notes } = parsed.data;
  const supabase = await createClient();

  const { data: accrued, error: readErr } = await supabase
    .from("affiliate_commissions")
    .select("id, amount")
    .eq("affiliate_id", affiliate_id)
    .eq("status", "accrued");
  if (readErr) return { error: readErr.message };

  const rows = accrued ?? [];
  if (rows.length === 0) {
    return { error: "This affiliate has no accrued commissions to pay out." };
  }
  const total = round2(rows.reduce((sum, r) => sum + (r.amount ?? 0), 0));
  const user = await getUser();

  const { data: payout, error: payErr } = await supabase
    .from("affiliate_payouts")
    .insert({
      affiliate_id,
      amount: total,
      method,
      reference,
      notes,
      paid_at: paid_at ?? new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (payErr || !payout) {
    return { error: payErr?.message ?? "Could not record the payout." };
  }

  const { error: markErr } = await supabase
    .from("affiliate_commissions")
    .update({
      status: "paid",
      payout_id: payout.id,
      updated_at: new Date().toISOString(),
    })
    .in(
      "id",
      rows.map((r) => r.id),
    )
    .eq("status", "accrued");
  if (markErr) return { error: markErr.message };

  revalidatePath(`/affiliates/${affiliate_id}`);
  return {
    success: true,
    notice: `Recorded a $${total.toFixed(2)} payout covering ${rows.length} commission${rows.length === 1 ? "" : "s"}.`,
  };
}

// --- Tax / compliance (super-admin only) ------------------------------------

const UpdateAffiliateTaxSchema = z.object({
  affiliate_id: z.uuid("An affiliate is required."),
  ein: optionalText,
});

/**
 * Set/clear an affiliate's EIN in the isolated, super-admin-only affiliate_private
 * store (written via the service-role client so it is never exposed to ordinary
 * staff or the portal). Leaves any W-9 metadata on the row untouched.
 */
export async function updateAffiliateTax(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = UpdateAffiliateTaxSchema.safeParse({
    affiliate_id: formData.get("affiliate_id"),
    ein: formData.get("ein"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { affiliate_id, ein } = parsed.data;

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to manage tax details." };
  }

  const { error } = await service
    .from("affiliate_private")
    .upsert(
      { affiliate_id, ein, updated_at: new Date().toISOString() },
      { onConflict: "affiliate_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/affiliates/${affiliate_id}`);
  return { success: true, notice: "Tax details updated." };
}

const W9_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Store an affiliate's completed IRS Form W-9. Super-admin only. The file goes to
 * the isolated private `affiliate-tax` bucket via the service-role client (the
 * bucket has NO authenticated policy, so it's unreadable by anyone else), its
 * metadata to affiliate_private, and the non-sensitive `w9_on_file` flag on
 * affiliates flips true so staff + the payout gate can see a W-9 exists without
 * reading it. The agreement requires a W-9 before any payout.
 */
export async function uploadW9(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const affiliateId = String(formData.get("affiliate_id") ?? "");
  if (!z.uuid().safeParse(affiliateId).success) {
    return { error: "An affiliate is required." };
  }

  const file = formData.get("w9");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a W-9 file to upload." };
  }
  const ext = W9_TYPES[file.type];
  if (!ext) return { error: "Upload a PDF, PNG, or JPEG." };
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File must be under 10 MB." };
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to store a W-9." };
  }

  // Note the prior file so a format change (w9.pdf → w9.png) doesn't orphan it.
  const { data: prior } = await service
    .from("affiliate_private")
    .select("w9_path")
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  const priorPath = (prior as { w9_path: string | null } | null)?.w9_path ?? null;

  const path = `${affiliateId}/w9.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await service.storage
    .from("affiliate-tax")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) return { error: upErr.message };

  if (priorPath && priorPath !== path) {
    await service.storage.from("affiliate-tax").remove([priorPath]);
  }

  const now = new Date().toISOString();
  const { error: privErr } = await service
    .from("affiliate_private")
    .upsert(
      {
        affiliate_id: affiliateId,
        w9_path: path,
        w9_filename: file.name,
        w9_uploaded_at: now,
        updated_at: now,
      },
      { onConflict: "affiliate_id" },
    );
  if (privErr) return { error: privErr.message };

  await service
    .from("affiliates")
    .update({ w9_on_file: true, updated_at: now })
    .eq("id", affiliateId);

  revalidatePath(`/affiliates/${affiliateId}`);
  revalidatePath("/affiliates");
  return { success: true, notice: "W-9 saved." };
}

/** Remove an affiliate's W-9 (file + metadata) and clear the on-file flag. Super-admin only. */
export async function removeW9(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const affiliateId = String(formData.get("affiliate_id") ?? "");
  if (!z.uuid().safeParse(affiliateId).success) {
    return { error: "An affiliate is required." };
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY to manage a W-9." };
  }

  const { data: row } = await service
    .from("affiliate_private")
    .select("w9_path")
    .eq("affiliate_id", affiliateId)
    .maybeSingle();
  const path = (row as { w9_path: string | null } | null)?.w9_path ?? null;
  if (path) {
    await service.storage.from("affiliate-tax").remove([path]);
  }

  const now = new Date().toISOString();
  await service
    .from("affiliate_private")
    .update({
      w9_path: null,
      w9_filename: null,
      w9_uploaded_at: null,
      updated_at: now,
    })
    .eq("affiliate_id", affiliateId);

  await service
    .from("affiliates")
    .update({ w9_on_file: false, updated_at: now })
    .eq("id", affiliateId);

  revalidatePath(`/affiliates/${affiliateId}`);
  revalidatePath("/affiliates");
  return { success: true, notice: "W-9 removed." };
}

const UpdateEventAttributionSchema = z.object({
  event_id: z.uuid("An event is required."),
  // Empty clears attribution (event is no longer sourced by any affiliate).
  affiliate_id: optionalUuid,
  // Optional per-event rate override, in percent. Empty → use the affiliate's
  // own rate. Reuses the pct→fraction conversion below.
  commission_pct_override: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .transform((v) => v.trim())
      .refine(
        (v) => {
          if (v === "") return true;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 && n <= 100;
        },
        { message: "Override must be between 0 and 100%." },
      )
      .transform((v) => (v === "" ? null : Number(v))),
  ),
});

/**
 * Attribute an event to an affiliate (or clear it) and optionally override the
 * commission rate for just this event. This is the one UI that writes the
 * event's affiliate_id + commission_rate_override that the payment reconciler
 * (lib/accounting/reconcile.ts) already consumes.
 *
 * Gated on affiliates-edit (sales/accounting/admin/super-admin) — a commercial
 * concern, NOT events-edit (which ops holds; ops must not touch commission
 * money). Because 'accounting' can edit affiliates but not events at the RLS
 * layer, the event write goes through the SERVICE-ROLE client: a permission-
 * gated system write, mirroring the payment/commission cascade. Changing
 * attribution re-syncs this event's outstanding (unpaid) commissions so owed
 * totals stay correct immediately; already-paid commissions are left for manual
 * clawback.
 */
export async function updateEventAttribution(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("affiliates");

  const parsed = UpdateEventAttributionSchema.safeParse({
    event_id: formData.get("event_id"),
    affiliate_id: formData.get("affiliate_id"),
    commission_pct_override: formData.get("commission_pct_override"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { event_id, affiliate_id, commission_pct_override } = parsed.data;

  // An override is meaningless without an attributed affiliate — drop it when
  // attribution is cleared so a stale rate can't linger on the row.
  const override =
    affiliate_id && commission_pct_override != null
      ? pctToRate(commission_pct_override)
      : null;

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return {
      error: "Add SUPABASE_SERVICE_ROLE_KEY to update event attribution.",
    };
  }

  // Capture the prior affiliate so their detail page refreshes too when
  // attribution moves away from them.
  const { data: prevRow } = await service
    .from("events")
    .select("affiliate_id")
    .eq("id", event_id)
    .maybeSingle();
  const prevAffiliateId =
    (prevRow as { affiliate_id: string | null } | null)?.affiliate_id ?? null;

  const { error } = await service
    .from("events")
    .update({ affiliate_id, commission_rate_override: override })
    .eq("id", event_id);
  if (error) return { error: error.message };

  // Re-sync outstanding commissions to the new affiliate/rate (or reverse them
  // if attribution was cleared). Paid commissions are untouched.
  await resyncEventAffiliateCommissions(service, event_id);

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/affiliates");
  for (const aid of new Set(
    [affiliate_id, prevAffiliateId].filter((v): v is string => Boolean(v)),
  )) {
    revalidatePath(`/affiliates/${aid}`);
  }

  return {
    success: true,
    notice: affiliate_id
      ? "Event attribution updated."
      : "Removed this event's affiliate attribution.",
  };
}
