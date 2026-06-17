/**
 * Roles and module-access policy. This mirrors the Postgres RLS policies (see
 * supabase/migrations/0007_rls_policies.sql) and drives which nav items and
 * routes a user can reach. Keep the two in sync.
 */

export const APP_ROLES = ["admin", "sales", "ops", "accounting"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  sales: "Sales & Marketing",
  ops: "Operations",
  accounting: "Accounting",
};

export type ModuleKey =
  | "dashboard"
  | "crm"
  | "events"
  | "operations"
  | "accounting"
  | "admin";

/** Which roles may access each module. `admin` is always allowed (see canAccess). */
export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ["admin", "sales", "ops", "accounting"],
  crm: ["admin", "sales"],
  events: ["admin", "sales", "ops"],
  operations: ["admin", "ops"],
  accounting: ["admin", "accounting"],
  admin: ["admin"],
};

/** True if `role` may access `module`. NULL role (pending) gets nothing. */
export function canAccess(role: AppRole | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return MODULE_ACCESS[module].includes(role);
}
