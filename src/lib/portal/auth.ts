import "server-only";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { isAffiliate } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { AffiliateRow } from "@/lib/affiliates/types";

/**
 * Portal auth gates. The affiliate reads their OWN affiliate row via the
 * owner-scoped RLS (affiliates_select). Staff who wander here are bounced to the
 * internal app. requirePortalAccess additionally enforces the first-login
 * contract-signing gate.
 */

export type PortalContext = { profileId: string; affiliate: AffiliateRow };

export async function requireAffiliate(): Promise<PortalContext> {
  const profile = await requireProfile();
  if (!isAffiliate(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("affiliates")
    .select(
      "*, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .maybeSingle();
  if (!data) redirect("/login");

  const { profiles, ...rest } = data as typeof data & {
    profiles: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  };
  const affiliate: AffiliateRow = {
    ...rest,
    full_name: profiles?.full_name ?? null,
    email: profiles?.email ?? null,
    phone: profiles?.phone ?? null,
  };
  return { profileId: profile.id, affiliate };
}

/** True once the affiliate has a signed commission agreement on file. */
export async function isContractSigned(affiliateId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("kind", "affiliate_contract")
    .eq("status", "signed")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Gate for the portal's content pages: an affiliate whose contract is not yet
 * signed is sent to the signing page first.
 */
export async function requirePortalAccess(): Promise<PortalContext> {
  const ctx = await requireAffiliate();
  const signed = await isContractSigned(ctx.affiliate.id);
  if (!signed) redirect("/portal/sign");
  return ctx;
}
