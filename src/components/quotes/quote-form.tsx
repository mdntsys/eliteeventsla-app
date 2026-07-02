"use client";

import { useActionState, useState } from "react";
import { createQuote } from "@/lib/quotes/actions";
import { formatMoney } from "@/lib/accounting/format";
import { Modal } from "@/components/ui/modal";
import { ContactSelect } from "@/components/crm/contact-select";
import type { ActionState, Option } from "@/lib/quotes/types";

/**
 * Toggleable card form to draft a quote with a live line-item editor. Mirrors
 * the invoice form; createQuote redirects to the new quote on success.
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

export function QuoteForm({
  contacts,
  companies,
}: {
  contacts: Option[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [tax, setTax] = useState("0");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createQuote,
    undefined,
  );

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New quote
      </button>

      {open && (
        <Modal title="New quote" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <input
              type="hidden"
              name="line_items"
              value={JSON.stringify(payload)}
            />

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted">Title</span>
              <input
                name="title"
                type="text"
                placeholder="e.g. Backyard wedding — photo booth package"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Contact</span>
              <ContactSelect
                name="contact_id"
                contacts={contacts}
                companies={companies}
              />
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
              <span className="text-xs text-muted">Valid until</span>
              <input name="valid_until" type="date" className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Notes</span>
              <input
                name="notes"
                type="text"
                placeholder="Optional"
                className={FIELD}
              />
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
                      onChange={(e) =>
                        setLine(i, { description: e.target.value })
                      }
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
                      onChange={(e) =>
                        setLine(i, { unit_price: e.target.value })
                      }
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
                          prev.length === 1
                            ? prev
                            : prev.filter((_, j) => j !== i),
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
                <span className="text-ink tabular-nums">
                  {formatMoney(subtotal)}
                </span>
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
                <span className="text-navy tabular-nums">
                  {formatMoney(total)}
                </span>
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
                {pending ? "Creating…" : "Create quote"}
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
        </Modal>
      )}
    </>
  );
}
