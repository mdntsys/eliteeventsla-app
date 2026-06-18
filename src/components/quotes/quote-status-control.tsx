"use client";

import { useActionState, useRef } from "react";
import { setQuoteStatus } from "@/lib/quotes/actions";
import type { ActionState, QuoteStatus } from "@/lib/quotes/types";

/** Inline <select> that updates a quote's status on change (gated server-side). */

const STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
];

const LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy disabled:opacity-60";

export function QuoteStatusControl({
  id,
  status,
}: {
  id: string;
  status: QuoteStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setQuoteStatus,
    undefined,
  );

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className={FIELD}
        aria-label="Quote status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-muted">Saving…</span>}
      {state?.error && (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
