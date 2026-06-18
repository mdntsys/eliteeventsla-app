"use client";

import { useActionState, useRef } from "react";
import { updateInvoiceStatus } from "@/lib/accounting/actions";
import type { ActionState, InvoiceStatus } from "@/lib/accounting/types";

/**
 * Inline <select> that updates an invoice's status on change (defense-in-depth
 * gated server-side). Mirrors the CRM deal-stage control.
 */

const STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "void",
];

const LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy disabled:opacity-60";

export function InvoiceStatusControl({
  id,
  status,
}: {
  id: string;
  status: InvoiceStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateInvoiceStatus,
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
        aria-label="Invoice status"
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
