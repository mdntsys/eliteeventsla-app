"use client";

import { useActionState, useState } from "react";
import { createSow } from "@/lib/documents/actions";
import { formatMoney } from "@/lib/accounting/format";
import type { ActionState } from "@/lib/documents/types";
import type { SowDefaults } from "@/lib/documents/queries";

/**
 * Client-side builder for a statement of work. Mirrors the invoice/quote
 * line-item editor: a local array of scope lines with a live total, serialized
 * to a JSON hidden field (name="scope_items"). createSow redirects to the new
 * document on success, so there's no success state to render here.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const COLS = "sm:grid-cols-[1fr_4.5rem_7rem_6rem_1.75rem]";

type Line = { description: string; quantity: string; amount: string };

const BLANK: Line = { description: "", quantity: "1", amount: "0" };

function lineAmount(line: Line): number {
  const a = Number(line.amount);
  return Number.isFinite(a) ? a : 0;
}

function seedLines(defaults?: SowDefaults | null): Line[] {
  const items = defaults?.scope_items ?? [];
  if (items.length === 0) return [{ ...BLANK }];
  return items.map((it) => ({
    description: it.description,
    quantity: String(it.quantity),
    amount: String(it.amount),
  }));
}

export function SowBuilder({ defaults }: { defaults?: SowDefaults | null }) {
  const [lines, setLines] = useState<Line[]>(() => seedLines(defaults));
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSow,
    undefined,
  );

  const total = lines.reduce((sum, l) => sum + lineAmount(l), 0);

  const payload = lines
    .filter((l) => l.description.trim() !== "")
    .map((l) => ({
      description: l.description,
      quantity: Number(l.quantity) || 0,
      amount: Number(l.amount) || 0,
    }));

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="scope_items" value={JSON.stringify(payload)} />

      {defaults?.event_id && (
        <input type="hidden" name="event_id" value={defaults.event_id} />
      )}
      {defaults?.contact_id && (
        <input type="hidden" name="contact_id" value={defaults.contact_id} />
      )}
      {defaults?.company_id && (
        <input type="hidden" name="company_id" value={defaults.company_id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Title</span>
          <input
            name="title"
            type="text"
            required
            defaultValue={defaults?.title ?? ""}
            placeholder="e.g. Statement of work — Backyard wedding"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Event title</span>
          <input
            name="event_title"
            type="text"
            required
            defaultValue={defaults?.event_title ?? ""}
            placeholder="e.g. Smith / Jones Wedding"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Event date</span>
          <input
            name="event_date"
            type="date"
            defaultValue={defaults?.event_date ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Client name</span>
          <input
            name="client_name"
            type="text"
            defaultValue={defaults?.client_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Client company</span>
          <input
            name="client_company"
            type="text"
            defaultValue={defaults?.client_company ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Signer name</span>
          <input
            name="signer_name"
            type="text"
            defaultValue={defaults?.signer_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Client email (where the SOW is sent)</span>
          <input
            name="signer_email"
            type="email"
            defaultValue={defaults?.signer_email ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Start</span>
          <input
            name="start_at"
            type="datetime-local"
            defaultValue={defaults?.start_at ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">End</span>
          <input
            name="end_at"
            type="datetime-local"
            defaultValue={defaults?.end_at ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Venue</span>
          <input
            name="venue_name"
            type="text"
            defaultValue={defaults?.venue_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Guest count</span>
          <input
            name="guest_count"
            type="number"
            min={0}
            step="1"
            defaultValue={defaults?.guest_count ?? ""}
            className={FIELD}
          />
        </label>
      </div>

      {/* Scope line items */}
      <div className="mt-2">
        <span className="eyebrow">Scope of work</span>

        {/* Column headers (desktop) */}
        <div className={`mt-2 mb-1.5 hidden gap-3 px-1 sm:grid ${COLS}`}>
          <span className="eyebrow">Description</span>
          <span className="eyebrow text-right">Qty</span>
          <span className="eyebrow text-right">Amount</span>
          <span className="eyebrow text-right">Total</span>
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
                    onChange={(e) => setLine(i, { description: e.target.value })}
                    placeholder="e.g. Full-service coordination — day of"
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
                    onChange={(e) => setLine(i, { quantity: e.target.value })}
                    aria-label="Quantity"
                    className={`${FIELD} w-full sm:text-right`}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="eyebrow sm:hidden">Amount</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                      aria-label="Amount"
                      className={`${FIELD} w-full pl-7 sm:text-right`}
                    />
                  </div>
                </label>

                <div className="flex items-center justify-between sm:justify-end">
                  <span className="eyebrow sm:hidden">Total</span>
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

      {/* Total */}
      <div className="ml-auto w-full border-t border-line pt-3 sm:w-72">
        <div className="flex items-center justify-between border-t border-line py-2 text-base font-medium">
          <span className="text-ink">Total</span>
          <span className="text-navy tabular-nums">{formatMoney(total)}</span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Notes</span>
        <textarea
          name="notes"
          rows={4}
          placeholder="Anything the client should know before signing"
          className={`${FIELD} w-full`}
        />
      </label>

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
          {pending ? "Creating…" : "Create SOW"}
        </button>
      </div>
    </form>
  );
}
