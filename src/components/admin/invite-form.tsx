"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inviteUser, type ActionState } from "@/lib/admin/actions";
import { APP_ROLES, ROLE_LABELS } from "@/lib/auth/roles";

/**
 * Toggleable inline form to invite a new user. Bound to inviteUser via
 * useActionState. On success it keeps the panel open to show the result notice
 * (which carries the temp password if the email couldn't be sent) and clears the
 * fields so another invite can be sent. Matches the deal/vendor form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function InviteForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    inviteUser,
    undefined,
  );

  // Clear the fields after a successful invite (DOM reset, not a state update),
  // keeping the panel + notice visible so the inviter can read the result.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Invite user
      </button>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <p className="eyebrow mb-3">Invite user</p>
      <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="name@example.com"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Full name</span>
          <input
            name="fullName"
            type="text"
            placeholder="Optional"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Role</span>
          <select name="role" defaultValue="" className={FIELD}>
            <option value="">No role (pending)</option>
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        {state?.error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-3">
            {state.error}
          </p>
        )}
        {state?.notice && (
          <p className="rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink sm:col-span-3">
            {state.notice}
          </p>
        )}

        <div className="mt-1 flex items-center gap-3 sm:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Send invite"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
          >
            Done
          </button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted">
        Creates the account and emails the person a branded welcome with a
        temporary password and a sign-in link. They change it from Account →
        Change password. Pick a role now or leave it pending.
      </p>
    </div>
  );
}
