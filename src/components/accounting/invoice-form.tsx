"use client";

import { useActionState, useState } from "react";
import { createInvoice } from "@/lib/accounting/actions";
import { formatMoney } from "@/lib/accounting/format";
import { Modal } from "@/components/ui/modal";
import {
  ContactSelect,
  type ContactSelectOption,
} from "@/components/crm/contact-select";
import type { ActionState, ContactOption, Option } from "@/lib/accounting/types";

/**
 * Create-invoice form, opened in a centered Modal. The company is derived from
 * the chosen contact (no separate company picker once a contact is selected —
 * the system already knows who they're under), and the line-item editor has
 * clear column headers with a live subtotal/tax/total. Submits the lines as a
 * JSON hidden field; createInvoice redirects to the new invoice on success.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const COLS = "sm:grid-cols-[1fr_4.5rem_7rem_6rem_1.75rem]";

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
  contacts: ContactOption[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedContact, setSelectedContact] =
    useState<ContactSelectOption | null>(null);
  const [lines, setLines] = useState<Line[]>([{ ...BLANK }]);
  const [tax, setTax] = useState("0");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInvoice,
    undefined,
  );

  // When the chosen contact belongs to a company, that's the invoice's company —
  // no need to ask (and no way to pick a mismatched one). Works for both an
  // existing pick and a contact just added inline (its company rides along).
  const derivedCompany =
    selectedContact?.company_id && selectedContact.company_name
      ? { id: selectedContact.company_id, name: selectedContact.company_name }
      : null;

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
        New invoice
      </button>

      {open && (
        <Modal title="New invoice" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-4">
            <input
              type="hidden"
              name="line_items"
              value={JSON.stringify(payload)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Contact</span>
                <ContactSelect
                  name="contact_id"
                  contacts={contacts}
                  companies={companies}
                  showCompanyInLabel
                  onChange={(_id, contact) => setSelectedContact(contact)}
                />
              </label>

              {/* Company: auto-derived from the contact when known, otherwise a
                  picker (e.g. billing a company with no specific contact). */}
              {derivedCompany ? (
                <div className="flex flex-col gap-1.5">
                  <span className="eyebrow">Company</span>
                  <input type="hidden" name="company_id" value={derivedCompany.id} />
                  <div className="flex items-center gap-2 rounded-(--radius-card) border border-line bg-cream/60 px-3.5 py-2.5 text-sm text-ink">
                    <span>{derivedCompany.name}</span>
                    <span className="text-xs text-muted">· from contact</span>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="eyebrow">Company</span>
                  <select name="company_id" defaultValue="" className={FIELD}>
                    <option value="">No company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Event</span>
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
                <span className="eyebrow">Invoice number</span>
                <input
                  name="invoice_number"
                  type="text"
                  placeholder="Auto-generated if blank"
                  className={FIELD}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Issued date</span>
                <input name="issued_date" type="date" className={FIELD} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Due date</span>
                <input name="due_date" type="date" className={FIELD} />
              </label>
            </div>

            {/* Line items */}
            <div className="mt-2">
              <span className="eyebrow">Line items</span>

              {/* Column headers (desktop) */}
              <div
                className={`mt-2 mb-1.5 hidden gap-3 px-1 sm:grid ${COLS}`}
              >
                <span className="eyebrow">Description</span>
                <span className="eyebrow text-right">Qty</span>
                <span className="eyebrow text-right">Unit price</span>
                <span className="eyebrow text-right">Amount</span>
                <span />
              </div>

              <div className="flex flex-col gap-3 sm:gap-2">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="rounded-(--radius-card) border border-line bg-cream/40 p-3 sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <div className={`grid gap-2 sm:items-center sm:gap-3 ${COLS}`}>
                      <label className="flex flex-col gap-1">
                        <span className="eyebrow sm:hidden">Description</span>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) =>
                            setLine(i, { description: e.target.value })
                          }
                          placeholder="e.g. On-site labor — 1 day"
                          className={`${FIELD} w-full`}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="eyebrow sm:hidden">Qty</span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={line.quantity}
                          onChange={(e) =>
                            setLine(i, { quantity: e.target.value })
                          }
                          aria-label="Quantity"
                          className={`${FIELD} w-full sm:text-right`}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="eyebrow sm:hidden">Unit price</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) =>
                              setLine(i, { unit_price: e.target.value })
                            }
                            aria-label="Unit price"
                            className={`${FIELD} w-full pl-7 sm:text-right`}
                          />
                        </div>
                      </label>

                      <div className="flex items-center justify-between sm:justify-end">
                        <span className="eyebrow sm:hidden">Amount</span>
                        <span className="text-sm font-medium text-ink tabular-nums">
                          {formatMoney(lineAmount(line))}
                        </span>
                      </div>

                      <div className="flex justify-end sm:block">
                        <button
                          type="button"
                          onClick={() =>
                            setLines((prev) =>
                              prev.length === 1
                                ? prev
                                : prev.filter((_, j) => j !== i),
                            )
                          }
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                          className="px-1.5 text-lg leading-none text-muted transition hover:text-red-700 disabled:opacity-30"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, { ...BLANK }])}
                className="mt-3 text-sm font-medium text-navy underline-offset-2 hover:underline"
              >
                + Add line
              </button>
            </div>

            {/* Totals */}
            <div className="ml-auto w-full border-t border-line pt-3 sm:w-72">
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-ink tabular-nums">
                  {formatMoney(subtotal)}
                </span>
              </div>
              <label className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted">Tax</span>
                <div className="relative w-28">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    $
                  </span>
                  <input
                    name="tax"
                    type="number"
                    min={0}
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className={`${FIELD} w-28 pl-7 text-right`}
                  />
                </div>
              </label>
              <div className="flex items-center justify-between border-t border-line py-2 text-base font-medium">
                <span className="text-ink">Total</span>
                <span className="text-navy tabular-nums">
                  {formatMoney(total)}
                </span>
              </div>
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-red-700">
                {state.error}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3">
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
        </Modal>
      )}
    </>
  );
}
