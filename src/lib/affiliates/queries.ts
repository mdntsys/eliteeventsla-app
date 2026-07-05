import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Affiliate,
  AffiliateEarnings,
  AffiliatePayout,
  AffiliateRow,
  CommissionRow,
  Option,
} from "@/lib/affiliates/types";

/** Round to cents to avoid float drift when summing money in JS. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Server-only data access for the affiliates module. Runs under the caller's
 * session (RLS): staff with affiliates-view see all; an affiliate sees only
 * their own row (owner-scoped select policy). The login's name/email/phone are
 * embedded from profiles via the profile_id FK (disambiguated by name, since
 * affiliates has two FKs to profiles).
 */

type ProfileEmbed = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
} | null;

function lift(a: Affiliate & { profiles: ProfileEmbed }): AffiliateRow {
  const { profiles, ...rest } = a;
  return {
    ...rest,
    full_name: profiles?.full_name ?? null,
    email: profiles?.email ?? null,
    phone: profiles?.phone ?? null,
  };
}

/** Every affiliate with its login name/email/phone, newest first. */
export async function listAffiliates(): Promise<AffiliateRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliates")
    .select(
      "*, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((a) =>
    lift(a as unknown as Affiliate & { profiles: ProfileEmbed }),
  );
}

/** A single affiliate with its login name/email/phone, or null. */
export async function getAffiliate(id: string): Promise<AffiliateRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliates")
    .select(
      "*, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return lift(data as unknown as Affiliate & { profiles: ProfileEmbed });
}

/** The affiliate row for the CURRENT signed-in affiliate (their portal), or null. */
export async function getMyAffiliate(): Promise<AffiliateRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliates")
    .select(
      "*, profiles!affiliates_profile_id_fkey(full_name, email, phone)",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return lift(data as unknown as Affiliate & { profiles: ProfileEmbed });
}

/** Active affiliates as {id, name} options for the deal attribution picker. */
export async function listAffiliateOptions(): Promise<Option[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliates")
    .select("id, status, profiles!affiliates_profile_id_fkey(full_name)")
    .eq("status", "active");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((a) => {
      const row = a as unknown as {
        id: string;
        profiles: { full_name: string | null } | null;
      };
      return { id: row.id, label: row.profiles?.full_name ?? "Unnamed affiliate" };
    })
    .sort((x, y) => x.label.localeCompare(y.label));
}

// --- Commissions & payouts --------------------------------------------------

/** An affiliate's commissions (event title + invoice number), newest first. */
export async function listAffiliateCommissions(
  affiliateId: string,
): Promise<CommissionRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliate_commissions")
    .select("*, events(title), invoices(invoice_number)")
    .eq("affiliate_id", affiliateId)
    .order("earned_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => {
    const { events, invoices, ...rest } = c as typeof c & {
      events: { title: string | null } | null;
      invoices: { invoice_number: string | null } | null;
    };
    return {
      ...rest,
      event_title: events?.title ?? null,
      invoice_number: invoices?.invoice_number ?? null,
    };
  });
}

/** An affiliate's recorded payouts, newest first. */
export async function listAffiliatePayouts(
  affiliateId: string,
): Promise<AffiliatePayout[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliate_payouts")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Rolled-up earned / paid / owed totals for an affiliate. */
export async function getAffiliateEarnings(
  affiliateId: string,
): Promise<AffiliateEarnings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("affiliate_commissions")
    .select("amount, status")
    .eq("affiliate_id", affiliateId);

  if (error) throw new Error(error.message);

  let owed = 0;
  let paid = 0;
  let accruedCount = 0;
  for (const c of data ?? []) {
    const amount = c.amount ?? 0;
    if (c.status === "accrued") {
      owed += amount;
      accruedCount += 1;
    } else if (c.status === "paid") {
      paid += amount;
    }
    // 'reversed' excluded from every total.
  }

  owed = round2(owed);
  paid = round2(paid);
  return { earned: round2(owed + paid), paid, owed, accruedCount };
}
