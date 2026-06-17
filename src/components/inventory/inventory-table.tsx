import Link from "next/link";
import type { InventoryListRow } from "@/lib/inventory/types";
import { StatusBadge, KindBadge } from "@/components/inventory/status-badge";

/**
 * Editorial table of inventory items. Server component — purely presentational
 * over the aggregated InventoryListRow[] shape from the queries layer.
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
  if (row.kind === "serialized") {
    return (
      <span className="tabular-nums">
        {row.available_units}/{row.unit_count}{" "}
        <span className="text-muted">available</span>
      </span>
    );
  }
  return <span className="tabular-nums">{row.quantity}</span>;
}

export function InventoryTable({ rows }: { rows: InventoryListRow[] }) {
  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line last:border-b-0 transition hover:bg-cream"
              >
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
