"use client";

import { useActionState } from "react";
import { voidPayout } from "@/lib/affiliates/actions";
import type { ActionState } from "@/lib/affiliates/types";

/**
 * Void a recorded payout from the affiliate's payout table: returns its
 * commissions to accrued (owed again) and marks the payout row voided while
 * keeping it for audit. Server-guarded on affiliates-edit.
 */
export function VoidPayoutButton({
  payoutId,
  affiliateId,
}: {
  payoutId: string;
  affiliateId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    voidPayout,
    undefined,
  );
  return (
    <form action={action} className="text-right">
      <input type="hidden" name="payout_id" value={payoutId} />
      <input type="hidden" name="affiliate_id" value={affiliateId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Voiding…" : "Void"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
