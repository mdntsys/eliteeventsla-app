"use client";

import { useActionState, useState } from "react";
import { createInvoice } from "@/lib/accounting/actions";
import { formatMoney } from "@/lib/accounting/format";
import type { ActionState, Option } from "@/lib/accounting/types";

/**
 * Toggleable card form to create an invoice with a dynamic line-item editor.
 * Bound to createInvoice via useActionState; subtotal/tax/total update live and
 * the lines are submitted as a JSON hidden field. createInvoice redirects to the
 * new invoice on success. Matches the CRM/vendors form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

type Line = { description: string; quantity: string; unit_price: string };

const BLANK: Line = { description: "", quantity: "1", unit_price: "0" };

function lineAmount(line: Line): number {
  const q = Number(line.quantity);
  const p = Number(line.unit_price);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
  return q * p;
}

export function InvoiceForm({
  events,
  contacts,
  companies,
}: {
  events: Option[];
  contacts: Option[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [tax, setTax] = useState("0");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInvoice,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New invoice
      </button>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const taxNum = Number(tax);
  const total = subtotal + (Number.isFinite(taxNum) ? taxNum : 0);

  const payload = lines
    .filter((l) => l.description.trim() !== "")
    .map((l) => ({
      description: l.description,
      quantity: Number(l.quantity) || 0,
      unit_price: Number(l.unit_price) || 0,
    }));

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <p className="eyebrow mb-3">New invoice</p>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="line_items" value={JSON.stringify(payload)} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Event</span>
          <select name="event_id" defaultValue="" className={FIELD}>
            <option value="">No event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Invoice number</span>
          <input
            name="invoice_number"
            type="text"
            placeholder="Auto-generated if blank"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Contact</span>
          <select name="contact_id" defaultValue="" className={FIELD}>
            <option value="">No contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Company</span>
          <select name="company_id" defaultValue="" className={FIELD}>
            <option value="">No company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Issued date</span>
          <input name="issued_date" type="date" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Due date</span>
          <input name="due_date" type="date" className={FIELD} />
        </label>

        {/* Line items */}
        <div className="sm:col-span-2">
          <span className="text-xs text-muted">Line items</span>
          <div className="mt-1.5 flex flex-col gap-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => setLine(i, { description: e.target.value })}
                  placeholder="Description"
                  className={`${FIELD} flex-1`}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                  aria-label="Quantity"
                  className={`${FIELD} w-20`}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) => setLine(i, { unit_price: e.target.value })}
                  aria-label="Unit price"
                  className={`${FIELD} w-28`}
                />
                <span className="w-24 shrink-0 text-right text-sm text-ink tabular-nums">
                  {formatMoney(lineAmount(line))}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length === 1 ? prev : prev.filter((_, j) => j !== i),
                    )
                  }
                  aria-label="Remove line"
                  className="px-1.5 text-muted transition hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { ...BLANK }])}
            className="mt-2 text-sm text-navy underline-offset-2 hover:underline"
          >
            + Add line
          </button>
        </div>

        {/* Totals */}
        <div className="sm:col-span-2 sm:ml-auto sm:w-72">
          <div className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted">Subtotal</span>
            <span className="text-ink tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          <label className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted">Tax</span>
            <input
              name="tax"
              type="number"
              min={0}
              step="0.01"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              className={`${FIELD} w-28 text-right`}
            />
          </label>
          <div className="flex items-center justify-between border-t border-line py-2 text-sm font-medium">
            <span className="text-ink">Total</span>
            <span className="text-navy tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

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
            {pending ? "Creating…" : "Create invoice"}
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
