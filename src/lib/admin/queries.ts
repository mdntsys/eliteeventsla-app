import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  AREAS,
  type Area,
  type AppRole,
  type PermissionMap,
} from "@/lib/auth/roles";

/**
 * Read paths for the Team console (super-admin only). RLS lets a super admin
 * read every profile and every user_module_permissions row.
 */

const AREA_SET = new Set<string>(AREAS);

/** A team member row shaped for the Team console UI. */
export type TeamMember = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
  is_active: boolean;
  is_super_admin: boolean;
  /** Explicit per-area override rows (absent area => follows role preset). */
  permissions: PermissionMap;
};

/**
 * List every profile with its explicit per-area override rows, shaped for the
 * Team console. Ordered super admins first, then by name/email.
 */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();

  const [{ data: profileRows, error: profileErr }, { data: permRows, error: permErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, role, is_active, is_super_admin")
        .order("is_super_admin", { ascending: false })
        .order("full_name", { ascending: true, nullsFirst: false })
        .order("email", { ascending: true, nullsFirst: false }),
      supabase
        .from("user_module_permissions")
        .select("user_id, module, can_view, can_edit"),
    ]);

  if (profileErr) throw new Error(profileErr.message);
  if (permErr) throw new Error(permErr.message);

  // Group override rows by user_id, ignoring any module not in the known AREAS
  // set (defensive against drift between the CHECK constraint and the app).
  const byUser = new Map<string, PermissionMap>();
  for (const row of permRows ?? []) {
    if (!AREA_SET.has(row.module)) continue;
    const map = byUser.get(row.user_id) ?? {};
    map[row.module as Area] = {
      can_view: row.can_view || row.can_edit, // edit implies view
      can_edit: row.can_edit,
    };
    byUser.set(row.user_id, map);
  }

  return (profileRows ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: p.role as AppRole | null,
    is_active: p.is_active,
    is_super_admin: p.is_super_admin ?? false,
    permissions: byUser.get(p.id) ?? {},
  }));
}
