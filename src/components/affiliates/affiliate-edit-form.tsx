"use client";

import { useActionState, useState } from "react";
import { updateAffiliate } from "@/lib/affiliates/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState, AffiliateRow } from "@/lib/affiliates/types";

/**
 * Edit an affiliate's commission rate, status, and notes. Closes on a
 * successful save (render-time, matching the deal/vendor edit-form pattern).
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function AffiliateEditForm({ affiliate }: { affiliate: AffiliateRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAffiliate,
    undefined,
  );

  if (state?.success && open) {
    setOpen(false);
  }

  const defaultPct = affiliate.commission_rate * 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
      >
        Edit
      </button>

      {open && (
        <Modal title="Edit affiliate" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={affiliate.id} />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Commission rate (%)</span>
              <input
                name="commission_pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={
                  Number.isInteger(defaultPct)
                    ? String(defaultPct)
                    : defaultPct.toFixed(2)
                }
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Status</span>
              <select
                name="status"
                defaultValue={affiliate.status}
                className={FIELD}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted">Notes</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={affiliate.notes ?? ""}
                className={`${FIELD} resize-y`}
              />
            </label>

            {state?.error && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                {state.error}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
