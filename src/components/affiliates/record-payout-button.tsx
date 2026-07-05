"use client";

import { useActionState, useMemo, useState } from "react";
import { recordPayout } from "@/lib/affiliates/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/affiliates/types";

/**
 * "Record payout" — records a payout covering the affiliate's accrued
 * commissions and marks them paid. Defaults to paying ALL of them, but each can
 * be unchecked for a partial payout. HARD-BLOCKED (with an explanatory banner)
 * until the affiliate has a W-9 on file, mirroring the server gate. Keeps the
 * modal open on success to show the confirmation.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

type AccruedCommission = { id: string; label: string; amount: number };

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function RecordPayoutButton({
  affiliateId,
  accruedCount,
  w9OnFile,
  accruedCommissions,
}: {
  affiliateId: string;
  accruedCount: number;
  w9OnFile: boolean;
  accruedCommissions: AccruedCommission[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPayout,
    undefined,
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(accruedCommissions.map((c) => c.id)),
  );

  const nothingOwed = accruedCount === 0;

  const { selectedTotal, selectedCount } = useMemo(() => {
    const chosen = accruedCommissions.filter((c) => selected.has(c.id));
    return {
      selectedTotal: chosen.reduce((s, c) => s + c.amount, 0),
      selectedCount: chosen.length,
    };
  }, [selected, accruedCommissions]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selectedCount === accruedCommissions.length;

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
          {!w9OnFile ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-(--radius-card) border border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                This affiliate has no W-9 on file. The commission agreement
                requires one before any payout — a super-admin can add it on the
                affiliate&rsquo;s page (Tax &amp; compliance).
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted transition hover:text-ink"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form action={action} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="affiliate_id" value={affiliateId} />

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    Commissions to pay ({selectedCount} of{" "}
                    {accruedCommissions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        allSelected
                          ? new Set()
                          : new Set(accruedCommissions.map((c) => c.id)),
                      )
                    }
                    className="text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-(--radius-card) border border-line">
                  {accruedCommissions.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 bg-cream px-3.5 py-2.5 text-sm">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            name="commission_ids"
                            value={c.id}
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="size-4 accent-navy"
                          />
                          <span className="text-ink">{c.label}</span>
                        </span>
                        <span className="tabular-nums text-muted">
                          {money(c.amount)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm text-muted sm:col-span-2">
                Records a payout of{" "}
                <strong className="text-ink">{money(selectedTotal)}</strong>{" "}
                covering {selectedCount} commission
                {selectedCount === 1 ? "" : "s"} and marks them paid. No funds are
                moved — this is a record of what you paid.
              </p>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">Method</span>
                <select
                  name="method"
                  defaultValue="bank_transfer"
                  className={FIELD}
                >
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
                  disabled={
                    pending || selectedCount === 0 || Boolean(state?.success)
                  }
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
          )}
        </Modal>
      )}
    </>
  );
}
