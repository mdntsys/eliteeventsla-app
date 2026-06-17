import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canAccess, type AppRole, type ModuleKey } from "@/lib/auth/roles";

/**
 * Data Access Layer — the single place auth/authorization is enforced for
 * reads. Per the Next.js 16 auth guide, the proxy is only an optimistic gate;
 * these checks (plus RLS) are the real enforcement. Wrapped in React `cache()`
 * so a request only hits Supabase once per render pass.
 */

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, phone, avatar_url, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile | null) ?? null;
});

/** Require a signed-in user; otherwise bounce to /login. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a profile row; otherwise bounce to /login. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Require that the current user's role can access `module`. Unauthorized users
 * are redirected to /dashboard, which only lists the modules they can access.
 * Deactivated and NULL-role users are intercepted earlier by (app)/layout.tsx;
 * is_active is re-checked here for defense in depth (and mirrors the RLS
 * helpers, which return no role when is_active is false).
 */
export async function requireModule(module: ModuleKey): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_active || !canAccess(profile.role, module)) {
    redirect("/dashboard");
  }
  return profile;
}
