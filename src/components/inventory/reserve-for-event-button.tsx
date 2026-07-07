"use client";

import { useState, useTransition } from "react";
import { reserveItemForEvent } from "@/lib/inventory/actions";
import type { AvailableUnitOption } from "@/lib/inventory/types";
import type { EventOption } from "@/lib/events/types";

/**
 * "Reserve for an event" — the inventory-tab counterpart to the event hub's
 * reserve form. Opens a small modal to pick an event (which pre-fills the
 * reserve window), a unit or quantity, and a rate, then writes the same
 * event_items reservation via reserveItemForEvent. Closes on success.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";

export function ReserveForEventButton({
  item,
  events,
}: {
  item: {
    id: string;
    name: string;
    kind: "bulk" | "serialized";
    available_now: number;
    available_unit_options: AvailableUnitOption[];
  };
  events: EventOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [eventId, setEventId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // When the chosen event changes, adopt its default reserve window.
  function onPickEvent(id: string) {
    setEventId(id);
    const ev = events.find((e) => e.id === id);
    setFrom(ev?.defaultFrom ?? "");
    setTo(ev?.defaultTo ?? "");
  }

  function close() {
    setOpen(false);
    setError(null);
    setEventId("");
    setFrom("");
    setTo("");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await reserveItemForEvent(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        close();
      }
    });
  }

  const isSerialized = item.kind === "serialized";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-navy hover:text-navy"
      >
        Reserve
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4 text-left"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-(--radius-card) border border-line bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">Reserve for an event</p>
        <h3 className="font-display mt-0.5 text-lg font-light text-navy">
          {item.name}
        </h3>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            There are no active events to reserve against yet.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="inventory_item_id" value={item.id} />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Event</span>
              <select
                name="event_id"
                required
                value={eventId}
                onChange={(e) => onPickEvent(e.target.value)}
                className={FIELD}
              >
                <option value="">Select an event…</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </label>

            {isSerialized ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">Unit</span>
                <select name="unit_id" className={FIELD} defaultValue="">
                  <option value="">Any available unit</option>
                  {item.available_unit_options.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.asset_tag ?? u.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="quantity" value={1} />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">
                  Quantity{" "}
                  <span className="text-muted">
                    ({item.available_now} available now)
                  </span>
                </span>
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

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">Reserved from</span>
                <input
                  name="reserved_from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">Reserved to</span>
                <input
                  name="reserved_to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Rate (optional)</span>
              <input
                name="rate"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className={FIELD}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-1 flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Reserving…" : "Reserve"}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
