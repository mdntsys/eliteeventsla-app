"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { updateEventAttribution } from "@/lib/affiliates/actions";
import type {
  ActionState,
  EventAffiliateSummary,
  Option,
} from "@/lib/affiliates/types";

/**
 * AFFILIATE & COMMISSION surface for the event hub. Shows which affiliate
 * sourced this booking, the effective commission rate (the affiliate's own rate
 * or a per-event override), and this event's commissions once an invoice is
 * fully paid. Staff with affiliates-edit can (re-)attribute the event and set an
 * override — the one UI that writes the fields the payment reconciler consumes.
 * Read-only for affiliates-viewers without edit.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const STATUS_LABELS: Record<string, string> = {
  accrued: "Accrued",
  paid: "Paid",
  reversed: "Reversed",
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/* ── Edit form ───────────────────────────────────────────────────────── */

function EditForm({
  eventId,
  summary,
  affiliateOptions,
  onClose,
}: {
  eventId: string;
  summary: EventAffiliateSummary;
  affiliateOptions: Option[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateEventAttribution,
    undefined,
  );

  // Close the editor once the save lands.
  useEffect(() => {
    if (state?.success) onClose();
  }, [state?.success, onClose]);

  const defaultPct =
    summary.overrideRate != null ? String(summary.overrideRate * 100) : "";

  return (
    <form action={action} className="mt-5 border-t border-line pt-5">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Referred by (affiliate)</span>
          <select
            name="affiliate_id"
            defaultValue={summary.affiliateId ?? ""}
            className={FIELD}
          >
            <option value="">— Not attributed —</option>
            {affiliateOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">
            Commission override (optional)
          </span>
          <div className="relative">
            <input
              name="commission_pct_override"
              type="number"
              min={0}
              max={100}
              step="0.1"
              defaultValue={defaultPct}
              placeholder={
                summary.defaultRate != null
                  ? `${formatPct(summary.defaultRate)} (default)`
                  : "Affiliate's rate"
              }
              className={`${FIELD} w-full pr-8`}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
              %
            </span>
          </div>
        </label>
      </div>

      <p className="mt-2 text-xs text-muted">
        Leave the override blank to use the affiliate&rsquo;s own rate. Changing
        attribution re-syncs this event&rsquo;s unpaid commissions; commissions
        already paid out are kept.
      </p>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save attribution"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────── */

export function EventAffiliatePanel({
  eventId,
  summary,
  affiliateOptions,
  canEdit,
}: {
  eventId: string;
  summary: EventAffiliateSummary;
  affiliateOptions: Option[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { commission } = summary;
  const hasCommissions = commission.rows.length > 0;

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">
          Affiliate &amp; commission
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-(--radius-card) border border-line px-3.5 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            {summary.affiliateId ? "Edit" : "Attribute"}
          </button>
        )}
      </div>

      {summary.affiliateId ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="eyebrow">Referred by</p>
            <p className="mt-1 text-sm text-ink">
              <Link
                href={`/affiliates/${summary.affiliateId}`}
                className="text-navy underline-offset-2 hover:underline"
              >
                {summary.affiliateName ?? "Affiliate"}
              </Link>
              {summary.affiliateStatus === "inactive" && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Inactive
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="eyebrow">Commission rate</p>
            <p className="mt-1 text-sm text-ink">
              {formatPct(summary.effectiveRate)}
              {summary.overrideRate != null && (
                <span className="ml-2 text-xs text-muted">
                  override · default {formatPct(summary.defaultRate)}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="eyebrow">Owed on this event</p>
            <p className="mt-1 text-sm text-ink tabular-nums">
              {formatMoney(commission.accrued)}
              {commission.paid > 0 && (
                <span className="ml-2 text-xs text-muted">
                  · {formatMoney(commission.paid)} paid
                </span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          Not attributed to an affiliate. Attribution is usually set on the deal;
          {canEdit ? " attribute it here" : " a Sales or Accounting teammate can set it"}{" "}
          to earn a referral commission when this event&rsquo;s invoices are paid.
        </p>
      )}

      {summary.affiliateId && (
        <div className="mt-5 border-t border-line pt-5">
          <p className="eyebrow mb-2">Commissions on this event</p>
          {hasCommissions ? (
            <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
              {commission.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 bg-cream px-4 py-2.5 text-sm"
                >
                  <span className="text-muted">
                    {row.invoice_number ?? "Invoice"} · {formatPct(row.rate)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-ink tabular-nums">
                      {formatMoney(row.amount)}
                    </span>
                    <span className="text-xs text-muted">
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              None yet — a commission accrues when an invoice on this event is
              fully paid.
            </p>
          )}
        </div>
      )}

      {editing && (
        <EditForm
          eventId={eventId}
          summary={summary}
          affiliateOptions={affiliateOptions}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
