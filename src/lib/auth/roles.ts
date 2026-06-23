/**
 * Roles + per-area access policy.
 *
 * This is the APP-LAYER mirror of the eventual Postgres RLS view-hiding policy
 * (that DB migration lands later — do not assume it exists yet). Two tiers:
 *
 *   - SUPER ADMIN (`profiles.is_super_admin`): bypasses every area check and is
 *     the ONLY tier that manages people/permissions (the "Admin" / Team console).
 *   - role (`admin | sales | ops | accounting`): business access. `admin` =
 *     full business access but NOT people management.
 *
 * Effective access for an area = super_admin ? full
 *   : (explicit user_module_permissions row if present, else the ROLE PRESET).
 * Absent override row => fall back to the role preset ("start full, dial back").
 * can_edit implies can_view.
 *
 * Keep AREAS in sync with the migration CHECK constraint on
 * user_module_permissions.module.
 */

export const APP_ROLES = ["admin", "sales", "ops", "accounting"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  sales: "Sales & Marketing",
  ops: "Operations",
  accounting: "Accounting",
};

/**
 * The 9 togglable areas. NOTE: the "admin" Team console is intentionally NOT an
 * area — it is super-admin-only and gated by `is_super_admin`, not by a per-area
 * permission.
 */
export const AREAS = [
  "dashboard",
  "crm",
  "quotes",
  "events",
  "inventory",
  "scheduling",
  "vendors",
  "servicing",
  "accounting",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  quotes: "Quotes",
  events: "Events",
  inventory: "Inventory",
  scheduling: "Scheduling",
  vendors: "Vendors",
  servicing: "Servicing",
  accounting: "Accounting",
};

/** A single area's effective permission. */
export type AreaPermission = { can_view: boolean; can_edit: boolean };

/** A user's explicit override rows, keyed by area. Missing area => no override. */
export type PermissionMap = Partial<Record<Area, AreaPermission>>;

/**
 * Role presets: per-area defaults used when a user has NO override row for that
 * area. A missing area entry means "no access" for that role.
 */
export const ROLE_AREA_DEFAULTS: Record<
  AppRole,
  Partial<Record<Area, { view: boolean; edit: boolean }>>
> = {
  admin: {
    dashboard: { view: true, edit: true },
    crm: { view: true, edit: true },
    quotes: { view: true, edit: true },
    events: { view: true, edit: true },
    inventory: { view: true, edit: true },
    scheduling: { view: true, edit: true },
    vendors: { view: true, edit: true },
    servicing: { view: true, edit: true },
    accounting: { view: true, edit: true },
  },
  sales: {
    dashboard: { view: true, edit: false },
    crm: { view: true, edit: true },
    quotes: { view: true, edit: true },
    events: { view: true, edit: true },
  },
  ops: {
    dashboard: { view: true, edit: false },
    events: { view: true, edit: true },
    inventory: { view: true, edit: true },
    scheduling: { view: true, edit: true },
    vendors: { view: true, edit: true },
    servicing: { view: true, edit: true },
  },
  accounting: {
    dashboard: { view: true, edit: false },
    accounting: { view: true, edit: true },
    events: { view: true, edit: false },
  },
};

type AccessSubject = {
  role: AppRole | null;
  is_super_admin: boolean;
  permissions: PermissionMap;
};

/** True if the subject may VIEW `area`. NULL role with no override => false. */
export function canView(p: AccessSubject, area: Area): boolean {
  if (p.is_super_admin) return true;
  const ov = p.permissions[area];
  if (ov) {
    // can_edit implies can_view (defensive: tolerate a stored row that set
    // edit without view).
    return ov.can_view || ov.can_edit;
  }
  if (!p.role) return false;
  const d = ROLE_AREA_DEFAULTS[p.role]?.[area];
  return !!d?.view;
}

/** True if the subject may EDIT `area`. Edit implies view. */
export function canEdit(p: AccessSubject, area: Area): boolean {
  if (p.is_super_admin) return true;
  const ov = p.permissions[area];
  if (ov) return ov.can_edit;
  if (!p.role) return false;
  const d = ROLE_AREA_DEFAULTS[p.role]?.[area];
  return !!d?.edit;
}

/**
 * @deprecated Legacy role-only access check. Superseded by canView/canEdit,
 * which also honor `is_super_admin` and explicit override rows. This shim only
 * inspects the role preset (no super-admin bypass, no overrides) and exists
 * solely so not-yet-migrated callers keep compiling. The legacy "operations"
 * ModuleKey maps to the inventory area; "admin" is unsupported here (use
 * requireSuperAdmin). Remove once all callers move to canView/canEdit.
 */
export type LegacyModuleKey =
  | "dashboard"
  | "crm"
  | "events"
  | "operations"
  | "accounting";

export function canAccess(
  role: AppRole | null | undefined,
  module: LegacyModuleKey,
): boolean {
  const area: Area = module === "operations" ? "inventory" : module;
  return canView(
    { role: role ?? null, is_super_admin: false, permissions: {} },
    area,
  );
}
