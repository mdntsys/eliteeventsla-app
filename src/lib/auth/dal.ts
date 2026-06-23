import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  canEdit,
  canView,
  AREAS,
  type Area,
  type AppRole,
  type PermissionMap,
} from "@/lib/auth/roles";

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
  is_super_admin: boolean;
  /** Explicit per-area override rows (user_module_permissions). */
  permissions: PermissionMap;
};

const AREA_SET = new Set<string>(AREAS);

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

  const [{ data: profileRow }, { data: permRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, phone, avatar_url, is_active, is_super_admin",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_module_permissions")
      .select("module, can_view, can_edit")
      .eq("user_id", user.id),
  ]);

  if (!profileRow) return null;

  // Build the override map. Ignore any module string not in the known AREAS set
  // (defensive against drift between the CHECK constraint and the app).
  const permissions: PermissionMap = {};
  for (const row of permRows ?? []) {
    if (!AREA_SET.has(row.module)) continue;
    permissions[row.module as Area] = {
      can_view: row.can_view || row.can_edit, // edit implies view
      can_edit: row.can_edit,
    };
  }

  return {
    id: profileRow.id,
    email: profileRow.email,
    full_name: profileRow.full_name,
    role: profileRow.role as AppRole | null,
    phone: profileRow.phone,
    avatar_url: profileRow.avatar_url,
    is_active: profileRow.is_active,
    is_super_admin: profileRow.is_super_admin ?? false,
    permissions,
  };
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
 * Require the super-admin tier (people/permission management). Anyone else is
 * sent to /dashboard.
 */
export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_super_admin) redirect("/dashboard");
  return profile;
}

/**
 * Require VIEW access to `area`. USE ON PAGES. Deactivated users and users
 * without view access are redirected to /dashboard (which only renders the
 * areas they can see). Mirrors the (forthcoming) RLS view-hiding policy.
 */
export async function requireView(area: Area): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_active || !canView(profile, area)) {
    redirect("/dashboard");
  }
  return profile;
}

/**
 * Require EDIT access to `area`. USE IN WRITE ACTIONS (defense in depth
 * alongside RLS). Edit implies view.
 */
export async function requireEdit(area: Area): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.is_active || !canEdit(profile, area)) {
    redirect("/dashboard");
  }
  return profile;
}

/**
 * @deprecated Thin compatibility shim for callers not yet migrated to
 * requireView/requireEdit/requireSuperAdmin. Maps the legacy ModuleKey strings
 * to the new area model:
 *   - "admin"      -> super-admin gate (Team console)
 *   - "operations" -> view of any operations area (inventory is the canonical
 *                     proxy; per-area gating is the migrating agent's job)
 *   - otherwise    -> requireView(area)
 * Remove once every module page/action has been migrated.
 */
export async function requireModule(
  module: Area | "operations" | "admin",
): Promise<Profile> {
  if (module === "admin") return requireSuperAdmin();
  if (module === "operations") return requireView("inventory");
  return requireView(module);
}
