"use client";

import { useActionState } from "react";
import { markDealLost, deleteDeal } from "@/lib/crm/actions";
import type { ActionState } from "@/lib/crm/types";

/**
 * Inline cleanup for one stale lead on the dashboard.
 *
 * Two ways out, because they mean different things: "Lost" keeps the lead and
 * its history but drops it off the board, while "Delete" is for a junk entry
 * that should never have been there. Delete is confirmed, and the server refuses
 * it outright for a deal that already became an event.
 */
export function StaleLeadActions({
  dealId,
  dealTitle,
}: {
  dealId: string;
  dealTitle: string;
}) {
  const [lostState, lostAction, lostPending] = useActionState<
    ActionState,
    FormData
  >(markDealLost, undefined);
  const [delState, delAction, delPending] = useActionState<
    ActionState,
    FormData
  >(deleteDeal, undefined);

  const error = lostState?.error ?? delState?.error;

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <form action={lostAction}>
          <input type="hidden" name="deal_id" value={dealId} />
          <button
            type="submit"
            disabled={lostPending || delPending}
            className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
          >
            {lostPending ? "Saving…" : "Mark lost"}
          </button>
        </form>
        <form
          action={delAction}
          onSubmit={(e) => {
            if (
              !window.confirm(
                `Delete “${dealTitle}”? This removes the lead and its notes for good. Its contact is kept. This can't be undone.`,
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="deal_id" value={dealId} />
          <button
            type="submit"
            disabled={lostPending || delPending}
            className="rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
          >
            {delPending ? "Deleting…" : "Delete"}
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="max-w-[240px] text-right text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
