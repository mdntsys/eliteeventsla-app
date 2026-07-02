"use client";

import { useActionState, useRef, useState } from "react";
import { updateInvoiceStatus } from "@/lib/accounting/actions";
import type { ActionState, InvoiceStatus } from "@/lib/accounting/types";

/**
 * Inline <select> that updates an invoice's status on change (defense-in-depth
 * gated server-side). Mirrors the CRM deal-stage control. Voiding an already-
 * issued invoice now emails the client (and BCCs the team), so selecting "Void"
 * asks for confirmation first — a mis-click shouldn't email a customer.
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
  // Track the last-committed value so a cancelled void can revert the select.
  const [current, setCurrent] = useState<InvoiceStatus>(status);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateInvoiceStatus,
    undefined,
  );

  function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as InvoiceStatus;
    // Voiding an ISSUED invoice emails the client — confirm before committing.
    // A never-issued draft sends no email (server skips it), so no prompt.
    if (next === "void" && current !== "void" && current !== "draft") {
      const ok = window.confirm(
        "Void this invoice? The client will be emailed that it has been voided, and the team will be BCC'd.",
      );
      if (!ok) {
        e.target.value = current; // revert the uncontrolled select
        return;
      }
    }
    setCurrent(next);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={onSelectChange}
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
      {state?.emailedTo && (
        <span className="text-xs text-muted">
          Void notice emailed to {state.emailedTo}
        </span>
      )}
      {state?.error && (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
