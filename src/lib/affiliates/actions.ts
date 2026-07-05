"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, requireEdit } from "@/lib/auth/dal";
import { sendEmail } from "@/lib/email/send";
import { affiliateWelcomeEmail } from "@/lib/email/templates";
import { optionalText, optionalDate } from "@/lib/forms/coercions";
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
