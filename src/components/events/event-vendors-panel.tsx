"use client";

import { useActionState, useState } from "react";
import {
  addEventVendor,
  updateEventVendorStatus,
  removeEventVendor,
} from "@/lib/vendors/actions";
import type {
  ActionState,
  EventVendorRow,
  VendorOption,
} from "@/lib/vendors/types";
import { StatusBadge } from "@/components/inventory/status-badge";

/**
 * VENDORS surface for the event hub. Lists the external partners tied to this
 * job (vendor, category, service, agreed cost, status) with a per-row status
 * control and a remove action, plus an "Add vendor" form that picks from the
 * active vendor directory. Surfaces the friendly duplicate (23505) error.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const EVENT_VENDOR_STATUSES = ["proposed", "confirmed", "declined"] as const;

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/* ── Per-row status control ──────────────────────────────────────────── */

function StatusControl({
  id,
  eventId,
  status,
}: {
  id: string;
  eventId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateEventVendorStatus,
    undefined,
  );

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="event_id" value={eventId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-(--radius-card) border border-line bg-cream px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-navy disabled:opacity-60"
      >
        {EVENT_VENDOR_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

/* ── Per-row remove ──────────────────────────────────────────────────── */

function RemoveButton({ id, eventId }: { id: string; eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeEventVendor,
    undefined,
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) px-2 py-1.5 text-xs font-medium text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

/* ── Vendor row ──────────────────────────────────────────────────────── */

function VendorRow({ row, eventId }: { row: EventVendorRow; eventId: string }) {
  return (
    <li className="flex items-start justify-between gap-4 bg-cream px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{row.vendor_name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {row.vendor_category ?? "Uncategorized"}
          {row.service ? ` · ${row.service}` : ""}
          {` · ${formatCurrency(row.agreed_cost)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge status={row.status} />
        <StatusControl id={row.id} eventId={eventId} status={row.status} />
        <RemoveButton id={row.id} eventId={eventId} />
      </div>
    </li>
  );
}

/* ── Add vendor form ─────────────────────────────────────────────────── */

function AddVendorForm({
  eventId,
  vendorOptions,
}: {
  eventId: string;
  vendorOptions: VendorOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addEventVendor,
    undefined,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Add vendor
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 border-t border-line pt-6">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="eyebrow mb-3">Add vendor</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Vendor</span>
          <select name="vendor_id" required className={FIELD} defaultValue="">
            <option value="">Select a vendor…</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.category_name ? ` (${v.category_name})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Service</span>
          <input
            name="service"
            type="text"
            placeholder="e.g. Catering"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Agreed cost</span>
          <input
            name="agreed_cost"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Status</span>
          <select name="status" defaultValue="proposed" className={FIELD}>
            {EVENT_VENDOR_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Notes</span>
          <input
            name="notes"
            type="text"
            placeholder="Optional"
            className={FIELD}
          />
        </label>
      </div>

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
          {pending ? "Adding…" : "Add vendor"}
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
  );
}

/* ── Panel ───────────────────────────────────────────────────────────── */

export function EventVendorsPanel({
  eventId,
  rows,
  vendorOptions,
}: {
  eventId: string;
  rows: EventVendorRow[];
  vendorOptions: VendorOption[];
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Vendors</h2>
        <span className="eyebrow">{rows.length} on this job</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No vendors on this job yet. Add a partner from the network below.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {rows.map((row) => (
            <VendorRow key={row.id} row={row} eventId={eventId} />
          ))}
        </ul>
      )}

      <AddVendorForm eventId={eventId} vendorOptions={vendorOptions} />
    </section>
  );
}
