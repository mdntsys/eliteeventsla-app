"use client";

import { useActionState, useMemo, useState } from "react";
import {
  reserveItem,
  removeEventItem,
  checkOutItem,
  checkOutAllItems,
} from "@/lib/events/actions";
import type {
  ActionState,
  Availability,
  EventDetail,
  EventItemRow,
} from "@/lib/events/types";
import type { InventoryListRow } from "@/lib/inventory/types";

/**
 * INVENTORY surface for the event hub. Shows reserved line items with their
 * checkout/return state and a per-line "Check out"; an availability summary per
 * distinct inventory item over the job window; and a "Reserve item" form that
 * surfaces the friendly double-booking error from the EXCLUDE constraint.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatWindow(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/* ── Per-line check-out ──────────────────────────────────────────────── */

function CheckOutButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    checkOutItem,
    undefined,
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
      >
        {pending ? "Checking out…" : "Check out"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

/* ── Per-line remove ─────────────────────────────────────────────────── */

function RemoveButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeEventItem,
    undefined,
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={itemId} />
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

/* ── Line item row ───────────────────────────────────────────────────── */

function LineItem({ line }: { line: EventItemRow }) {
  const checkedOut = line.checked_out_at != null;
  const returned = line.returned_at != null;
  const window = formatWindow(line.reserved_from, line.reserved_to);

  const lineState = returned ? "returned" : checkedOut ? "in_use" : "reserved";
  const lineLabel = returned
    ? "Returned"
    : checkedOut
      ? "Checked out"
      : "Reserved";

  return (
    <li className="flex items-start justify-between gap-4 bg-cream px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {line.item_name}
          {line.unit_asset_tag ? (
            <span className="ml-2 font-mono text-xs text-muted">
              {line.unit_asset_tag}
            </span>
          ) : (
            <span className="ml-2 text-xs text-muted">×{line.quantity}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {line.item_kind === "serialized" ? "Serialized" : "Bulk"}
          {window ? ` · ${window}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            lineState === "returned"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-line bg-cream-deep text-muted"
          }`}
        >
          {lineLabel}
        </span>
        {!checkedOut && <CheckOutButton itemId={line.id} />}
        {!checkedOut && <RemoveButton itemId={line.id} />}
      </div>
    </li>
  );
}

/* ── Availability summary per distinct inventory item ────────────────── */

function AvailabilityRow({
  name,
  availability,
}: {
  name: string;
  availability: Availability;
}) {
  const detail =
    availability.kind === "serialized"
      ? availability.units
          .map(
            (u) =>
              `${u.asset_tag ?? "unit"} ${
                u.available
                  ? "free"
                  : u.conflict_event_title
                    ? `→ ${u.conflict_event_title}`
                    : "busy"
              }`,
          )
          .join(" · ")
      : `${availability.available} free of ${availability.total}`;

  return (
    <li className="bg-cream px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{name}</p>
        <span className="text-xs font-medium text-navy">
          {availability.available} of {availability.total} available
        </span>
      </div>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </li>
  );
}

/* ── Bulk check-out ("Check out all") ────────────────────────────────── */

function CheckOutAllButton({
  eventId,
  remaining,
}: {
  eventId: string;
  remaining: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    checkOutAllItems,
    undefined,
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        disabled={pending || remaining === 0}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-xs font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Checking out…" : "Check out all"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

/* ── Reserve form ────────────────────────────────────────────────────── */

function ReserveForm({
  eventId,
  inventory,
  defaultFrom,
  defaultTo,
}: {
  eventId: string;
  inventory: InventoryListRow[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reserveItem,
    undefined,
  );
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(
    () => inventory.find((i) => i.id === selectedId) ?? null,
    [inventory, selectedId],
  );
  const isSerialized = selected?.kind === "serialized";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Reserve item
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 border-t border-line pt-6">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="eyebrow mb-3">Reserve item</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Inventory item</span>
          <select
            name="inventory_item_id"
            required
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={FIELD}
          >
            <option value="">Select an item…</option>
            {inventory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.kind})
              </option>
            ))}
          </select>
        </label>

        {isSerialized ? (
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs text-muted">Unit ID (optional)</span>
            <input
              name="unit_id"
              type="text"
              placeholder="Leave blank to pick any available unit"
              className={FIELD}
            />
            <input type="hidden" name="quantity" value={1} />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Quantity</span>
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              required
              className={FIELD}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Rate</span>
          <input
            name="rate"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Reserved from</span>
          <input
            name="reserved_from"
            type="date"
            defaultValue={defaultFrom}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Reserved to</span>
          <input
            name="reserved_to"
            type="date"
            defaultValue={defaultTo}
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
          {pending ? "Reserving…" : "Reserve"}
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

export function InventoryPanel({
  ev,
  availabilityByItem,
  inventory,
}: {
  ev: EventDetail;
  availabilityByItem: Record<string, Availability>;
  inventory: InventoryListRow[];
}) {
  // Window defaults for the reserve form (job window or the event day).
  const day = ev.event_date ?? (ev.start_at ? ev.start_at.slice(0, 10) : "");
  const defaultFrom = ev.start_at ? ev.start_at.slice(0, 10) : day;
  const defaultTo = ev.end_at ? ev.end_at.slice(0, 10) : day;

  // Lines still in the warehouse (reservable but not yet loaded) → "Check out all".
  const remaining = ev.items.filter(
    (line) => line.checked_out_at == null && line.returned_at == null,
  ).length;

  // Distinct inventory items reserved on this job, for the availability summary.
  const distinct = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of ev.items) {
      if (!map.has(line.inventory_item_id)) {
        map.set(line.inventory_item_id, line.item_name);
      }
    }
    return Array.from(map.entries());
  }, [ev.items]);

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Inventory</h2>
        <div className="flex items-center gap-3">
          <span className="eyebrow">{ev.items.length} reserved</span>
          {remaining > 0 && (
            <CheckOutAllButton eventId={ev.id} remaining={remaining} />
          )}
        </div>
      </div>

      {ev.items.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No items reserved yet. Reserve gear for this job below.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {ev.items.map((line) => (
            <LineItem key={line.id} line={line} />
          ))}
        </ul>
      )}

      {distinct.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-3">Availability over job window</p>
          <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
            {distinct.map(([itemId, name]) => {
              const availability = availabilityByItem[itemId];
              if (!availability) return null;
              return (
                <AvailabilityRow
                  key={itemId}
                  name={name}
                  availability={availability}
                />
              );
            })}
          </ul>
        </div>
      )}

      <ReserveForm
        eventId={ev.id}
        inventory={inventory}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
      />
    </section>
  );
}
