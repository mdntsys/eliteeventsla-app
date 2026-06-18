"use client";

import { useState } from "react";
import type { InventoryListRow } from "@/lib/inventory/types";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { SearchField } from "@/components/shared/search-field";

function haystack(row: InventoryListRow): string {
  return [row.name, row.sku, row.category_name, row.location_summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Instant search over the inventory table — name, SKU, category, location. */
export function InventoryBrowser({ rows }: { rows: InventoryListRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm ? rows.filter((r) => haystack(r).includes(norm)) : rows;

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

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No items match “{query.trim()}”.
        </p>
      ) : (
        <InventoryTable rows={filtered} />
      )}
    </div>
  );
}
