"use client";

import { useState, useTransition } from "react";
import {
  setUserRole,
  toggleSuperAdmin,
  setUserActive,
  setAreaPermission,
  resetAreaPermission,
  type ActionState,
} from "@/lib/admin/actions";
import {
  APP_ROLES,
  AREAS,
  AREA_LABELS,
  ROLE_LABELS,
  ROLE_AREA_DEFAULTS,
  canEdit,
  canView,
  type Area,
  type AppRole,
} from "@/lib/auth/roles";
import type { TeamMember } from "@/lib/admin/queries";

/**
 * A single team member: identity, role <select>, Super Admin + Active toggles,
 * and a per-area View/Edit MATRIX. The matrix shows EFFECTIVE access (role
 * preset unless an explicit override exists) and writes overrides only to
 * restrict below — or back to — the preset (setAreaPermission deletes the row
 * when it matches the preset). Non-form mutations are fired through a
 * transition; whether they succeed is reflected by the server re-render.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";

function initials(name: string | null, email: string | null): string {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function TeamMemberCard({
  member,
  isSelf,
}: {
  member: TeamMember;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The access subject used to compute effective view/edit for the matrix.
  const subject = {
    role: member.role,
    is_super_admin: member.is_super_admin,
    permissions: member.permissions,
  };

  function run(fn: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
    });
  }

  const name = member.full_name ?? member.email ?? "Unknown user";

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-medium text-cream">
            {initials(member.full_name, member.email)}
          </div>
          <div>
            <p className="font-medium text-ink">
              {name}
              {isSelf && (
                <span className="ml-2 text-xs text-muted">(you)</span>
              )}
            </p>
            {member.email && member.full_name && (
              <p className="text-xs text-muted">{member.email}</p>
            )}
            {!member.is_active && (
              <p className="text-xs text-red-700">Deactivated</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-wide text-muted">
              Role
            </span>
            <select
              value={member.role ?? ""}
              disabled={pending}
              onChange={(e) =>
                run(() =>
                  setUserRole(
                    member.id,
                    e.target.value === ""
                      ? null
                      : (e.target.value as AppRole),
                  ),
                )
              }
              className={FIELD}
            >
              <option value="">No role (pending)</option>
              {APP_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={member.is_super_admin}
              disabled={pending}
              onChange={(e) =>
                run(() => toggleSuperAdmin(member.id, e.target.checked))
              }
              className="h-4 w-4 accent-navy"
            />
            Super Admin
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={member.is_active}
              disabled={pending}
              onChange={(e) =>
                run(() => setUserActive(member.id, e.target.checked))
              }
              className="h-4 w-4 accent-navy"
            />
            Active
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Per-area View/Edit matrix */}
      <div className="mt-5 border-t border-line pt-4">
        {member.is_super_admin ? (
          <p className="text-sm text-muted">
            Super admins have full access to every area; per-area permissions do
            not apply.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Area access</p>
              <p className="text-xs text-muted">
                Checked = access. Unchecked from preset = restricted.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1.5 pr-4 font-normal">Area</th>
                    <th className="px-3 py-1.5 text-center font-normal">
                      View
                    </th>
                    <th className="px-3 py-1.5 text-center font-normal">
                      Edit
                    </th>
                    <th className="px-3 py-1.5 text-center font-normal">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {AREAS.map((area) => {
                    const v = canView(subject, area);
                    const e = canEdit(subject, area);
                    const overridden = area in member.permissions;
                    return (
                      <tr key={area} className="border-t border-line">
                        <td className="py-2 pr-4 text-ink">
                          {AREA_LABELS[area]}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${AREA_LABELS[area]} view`}
                            checked={v}
                            disabled={pending}
                            onChange={(ev) => {
                              const nextView = ev.target.checked;
                              // Turning off view turns off edit too.
                              run(() =>
                                setAreaPermission(
                                  member.id,
                                  area,
                                  nextView,
                                  nextView ? e : false,
                                ),
                              );
                            }}
                            className="h-4 w-4 accent-navy"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${AREA_LABELS[area]} edit`}
                            checked={e}
                            disabled={pending}
                            onChange={(ev) => {
                              const nextEdit = ev.target.checked;
                              // Edit implies view.
                              run(() =>
                                setAreaPermission(
                                  member.id,
                                  area,
                                  nextEdit ? true : v,
                                  nextEdit,
                                ),
                              );
                            }}
                            className="h-4 w-4 accent-navy"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {overridden ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(() =>
                                  resetAreaPermission(member.id, area),
                                )
                              }
                              className="text-xs text-muted underline transition hover:text-navy disabled:opacity-60"
                            >
                              Reset
                            </button>
                          ) : (
                            <span className="text-xs text-muted">
                              {presetLabel(member.role, area)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Short label describing the role-preset default for an area (no override). */
function presetLabel(role: AppRole | null, area: Area): string {
  if (!role) return "Preset: none";
  const d = ROLE_AREA_DEFAULTS[role]?.[area];
  if (!d?.view) return "Preset: none";
  return d.edit ? "Preset: edit" : "Preset: view";
}
