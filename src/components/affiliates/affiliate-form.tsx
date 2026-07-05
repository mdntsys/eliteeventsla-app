"use client";

import { useActionState, useState } from "react";
import { createAffiliate } from "@/lib/affiliates/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/affiliates/types";

/**
 * "New affiliate" modal. Creates the partner's login + affiliate record and
 * emails them a welcome (temp password + sign-in link). On success we surface
 * the returned notice (which carries the temp password if email is off/failed)
 * and keep the modal open so the operator can copy it before closing.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function AffiliateForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createAffiliate,
    undefined,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New affiliate
      </button>

      {open && (
        <Modal title="New affiliate" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Full name</span>
              <input name="full_name" type="text" required className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Email</span>
              <input name="email" type="email" required className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Phone</span>
              <input name="phone" type="tel" className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Commission rate (%)</span>
              <input
                name="commission_pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue="15"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">EIN (optional)</span>
              <input
                name="ein"
                type="text"
                placeholder="Stored privately"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted">Notes</span>
              <textarea name="notes" rows={2} className={`${FIELD} resize-y`} />
            </label>

            {state?.error && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                {state.error}
              </p>
            )}

            {state?.notice && (
              <p className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-sm text-ink sm:col-span-2">
                {state.notice}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create affiliate"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
              >
                {state?.success ? "Close" : "Cancel"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
