"use client";

import { useActionState } from "react";
import { deleteDeal } from "@/lib/crm/actions";
import type { ActionState } from "@/lib/crm/types";

/**
 * "Delete lead" for the deal page. For a junk or truly dead entry — marking it
 * lost is the softer option and keeps the history. Confirmed on click, and the
 * server refuses outright if the deal was already booked as an event (deleting
 * would quietly sever the booking from the lead it came from).
 */
export function DeleteDealButton({
  dealId,
  dealTitle,
}: {
  dealId: string;
  dealTitle: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteDeal,
    undefined,
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${dealTitle}”? This removes the lead and its notes for good. Its contact is kept. This can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-1"
    >
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="redirect_to" value="/crm/deals" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete lead"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
