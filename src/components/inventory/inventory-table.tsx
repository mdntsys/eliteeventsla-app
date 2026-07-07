"use client";

import Link from "next/link";
import type { InventoryListRow } from "@/lib/inventory/types";
import type { EventOption } from "@/lib/events/types";
import { StatusBadge, KindBadge } from "@/components/inventory/status-badge";
import { ReserveForEventButton } from "@/components/inventory/reserve-for-event-button";

/**
 * Editorial table of inventory items with row selection (for bulk location
 * assignment), a live "available now / in use" stock cell, and a per-row
 * "Reserve for an event" action.
 */

function formatDailyRate(rate: number | null): string {
  if (rate == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate);
}

function StockCell({ row }: { row: InventoryListRow }) {
  const total = row.kind === "serialized" ? row.unit_count : row.quantity ?? 0;
  return (
    <div className="tabular-nums">
      <span className="text-ink">{row.available_now}</span>
      <span className="text-muted">
        /{total} available
      </span>
      {row.in_use_now > 0 && (
        <div
          className="mt-0.5 text-xs font-medium text-amber-700"
          title={
            row.active_event_titles.length > 0
              ? `On: ${row.active_event_titles.join(", ")}`
              : undefined
          }
        >
          {row.in_use_now} in use now
        </div>
      )}
    </div>
  );
}

export function InventoryTable({
  rows,
  events,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  rows: InventoryListRow[];
  events: EventOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="h-4 w-4 accent-navy"
                />
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="sr-only">Image</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Name</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Location</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Category</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Type</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Stock</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Daily rate</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Status</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line last:border-b-0 transition hover:bg-cream"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    checked={selectedIds.has(row.id)}
                    onChange={() => onToggle(row.id)}
                    className="h-4 w-4 accent-navy"
                  />
                </td>
                <td className="px-4 py-3">
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.image_url}
                      alt={row.name}
                      className="h-10 w-10 rounded-(--radius-card) border border-line object-cover"
                    />
                  ) : (
                    <span className="block h-10 w-10 rounded-(--radius-card) border border-dashed border-line bg-cream" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/operations/inventory/${row.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    {row.sku && (
                      <span className="text-xs text-muted">{row.sku}</span>
                    )}
                    {row.open_maintenance > 0 && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {row.open_maintenance} open maintenance
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.location_summary ?? (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.category_name ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <KindBadge kind={row.kind} />
                </td>
                <td className="px-4 py-3 text-ink">
                  <StockCell row={row} />
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {formatDailyRate(row.daily_rate)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status !== "retired" && (
                    <ReserveForEventButton
                      item={{
                        id: row.id,
                        name: row.name,
                        kind: row.kind,
                        available_now: row.available_now,
                        available_unit_options: row.available_unit_options,
                      }}
                      events={events}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
