"use client";

import type { InventoryListRow } from "@/lib/inventory/types";

/**
 * "Export CSV" button — serializes the current inventory (already fetched by
 * the page) into a stock-report CSV and triggers a client-side download. Pure
 * client work: no server round-trip, no new query. Mirrors the Import
 * affordance so operators can pull a list for audits/insurance/reporting.
 */

const HEADERS = [
  "name",
  "sku",
  "kind",
  "category",
  "status",
  "quantity",
  "available_units",
  "unit_count",
  "daily_rate",
  "replacement_cost",
  "location",
  "open_maintenance",
] as const;

/** RFC-4180-style cell: quote when the value contains a comma, quote, or newline. */
function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: InventoryListRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.sku,
        r.kind,
        r.category_name,
        r.status,
        r.quantity,
        r.available_units,
        r.unit_count,
        r.daily_rate,
        r.replacement_cost,
        r.location_summary,
        r.open_maintenance,
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function CsvExport({ rows }: { rows: InventoryListRow[] }) {
  function handleExport() {
    const blob = new Blob([toCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-card disabled:opacity-60"
    >
      Export CSV
    </button>
  );
}
