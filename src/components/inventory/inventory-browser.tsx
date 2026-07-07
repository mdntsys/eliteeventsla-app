"use client";

import { useCallback, useState } from "react";
import type { InventoryListRow } from "@/lib/inventory/types";
import type { EventOption } from "@/lib/events/types";
import type { LocationOption } from "@/lib/locations/types";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { BulkLocationBar } from "@/components/inventory/bulk-location-bar";
import { SearchField } from "@/components/shared/search-field";

function haystack(row: InventoryListRow): string {
  return [row.name, row.sku, row.category_name, row.location_summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Instant search over the inventory table (name, SKU, category, location) with
 * row selection for bulk location assignment and a per-row reserve action.
 */
export function InventoryBrowser({
  rows,
  events,
  locationOptions,
}: {
  rows: InventoryListRow[];
  events: EventOption[];
  locationOptions: LocationOption[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const norm = query.trim().toLowerCase();
  const filtered = norm ? rows.filter((r) => haystack(r).includes(norm)) : rows;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of filtered) {
          if (checked) next.add(r.id);
          else next.delete(r.id);
        }
        return next;
      });
    },
    [filtered],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedIds = Array.from(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search items…"
          label="Search inventory"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "item" : "items"}`}
        </p>
      </div>

      {selectedIds.length > 0 && (
        <BulkLocationBar
          selectedIds={selectedIds}
          locationOptions={locationOptions}
          onAssigned={clearSelection}
        />
      )}

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No items match “{query.trim()}”.
        </p>
      ) : (
        <InventoryTable
          rows={filtered}
          events={events}
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      )}
    </div>
  );
}
