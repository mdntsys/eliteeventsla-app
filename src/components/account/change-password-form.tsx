"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type ActionState } from "@/lib/account/actions";

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changePassword,
    undefined,
  );

  // Clear the fields after a successful change (DOM reset — not a state update).
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Current password</span>
        <input
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">New password</span>
        <input
          name="new_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Confirm new password</span>
        <input
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={FIELD}
        />
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700">
          Password updated. Use it next time you sign in.
        </p>
      )}

      <div className="mt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
