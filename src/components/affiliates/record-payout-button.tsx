"use client";

import { useActionState, useState } from "react";
import { recordPayout } from "@/lib/affiliates/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/affiliates/types";

/**
 * "Record payout" — records a payout covering ALL of the affiliate's currently
 * accrued commissions (their owed balance) and marks them paid. Disabled when
 * nothing is owed. Keeps the modal open on success to show the confirmation.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function RecordPayoutButton({
  affiliateId,
  owed,
  accruedCount,
}: {
  affiliateId: string;
  owed: number;
  accruedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPayout,
    undefined,
  );

  const nothingOwed = accruedCount === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={nothingOwed}
        title={nothingOwed ? "No accrued commissions to pay out" : undefined}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-50"
      >
        Record payout
      </button>

      {open && (
        <Modal title="Record payout" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="affiliate_id" value={affiliateId} />

            <p className="text-sm text-muted sm:col-span-2">
              Records a payout of{" "}
              <strong className="text-ink">${owed.toFixed(2)}</strong> covering{" "}
              {accruedCount} accrued commission
              {accruedCount === 1 ? "" : "s"} and marks them paid. No funds are
              moved — this is a record of what you paid.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Method</span>
              <select name="method" defaultValue="bank_transfer" className={FIELD}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Reference</span>
              <input
                name="reference"
                type="text"
                placeholder="Check # / transfer id"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Paid on</span>
              <input name="paid_at" type="date" className={FIELD} />
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
                disabled={pending || Boolean(state?.success)}
                className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Recording…" : "Record payout"}
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
