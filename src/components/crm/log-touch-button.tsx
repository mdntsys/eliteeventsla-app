"use client";

import { useActionState } from "react";
import { logDealTouch } from "@/lib/crm/actions";
import type { ActionState } from "@/lib/crm/types";

/**
 * "Log a touch" — one click to record that we reached out again. Bumps the
 * deal's attempt count, stamps today (Pacific) as last-contacted, and adds a
 * line to the activity log so the timeline keeps the dates, not just the total.
 *
 * The count is also editable on the deal form, for backfilling a lead that was
 * already chased a few times before this existed.
 */
export function LogTouchButton({ dealId }: { dealId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    logDealTouch,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="deal_id" value={dealId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-line px-3 py-1.5 text-xs font-medium text-navy transition hover:border-navy disabled:opacity-60"
      >
        {pending ? "Logging…" : "+ Log a touch"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
