import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Affiliate, AffiliateRow, Option } from "@/lib/affiliates/types";

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
