"use client";

import { useActionState, useState } from "react";
import { recordPayment } from "@/lib/accounting/actions";
import type { ActionState, Option } from "@/lib/accounting/types";

/**
 * Toggleable form to record a payment. On an invoice detail it's bound to that
 * invoice (hidden invoice_id); on the Payments page it offers an invoice select.
 * Bound to recordPayment via useActionState, which reconciles the invoice.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const METHODS = [
  ["card", "Card"],
  ["cash", "Cash"],
  ["check", "Check"],
  ["bank_transfer", "Bank transfer"],
  ["stripe", "Stripe"],
] as const;

const STATUSES = [
  ["succeeded", "Succeeded"],
  ["pending", "Pending"],
  ["processing", "Processing"],
  ["failed", "Failed"],
  ["refunded", "Refunded"],
] as const;

export function PaymentForm({
  invoiceId,
  eventId,
  invoices,
  label = "Record payment",
}: {
  invoiceId?: string;
  eventId?: string;
  invoices?: Option[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPayment,
    undefined,
  );

  // Close on a successful save (matches the deal/vendor form pattern).
  if (state?.success && open) {
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line px-4 py-2 text-sm font-medium text-navy transition hover:border-navy"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <p className="eyebrow mb-3">Record payment</p>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
        {eventId && <input type="hidden" name="event_id" value={eventId} />}

        {!invoiceId && invoices && (
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs text-muted">Invoice</span>
            <select name="invoice_id" defaultValue="" className={FIELD}>
              <option value="">No invoice (event payment)</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Amount</span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="0.00"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Method</span>
          <select name="method" defaultValue="card" className={FIELD}>
            {METHODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Status</span>
          <select name="status" defaultValue="succeeded" className={FIELD}>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Paid date</span>
          <input name="paid_at" type="date" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Notes</span>
          <input
            name="notes"
            type="text"
            placeholder="Reference, memo…"
            className={FIELD}
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
            {pending ? "Saving…" : "Save payment"}
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
    </div>
  );
}
