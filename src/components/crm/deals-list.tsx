"use client";

import { useState } from "react";
import Link from "next/link";
import type { DealRow } from "@/lib/crm/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import { SearchField } from "@/components/shared/search-field";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // Date-only columns (follow_up_date, expected_event_date) parse as UTC
    // midnight — format in UTC so they don't render a day early west of UTC.
    timeZone: "UTC",
  });
}

function haystack(d: DealRow): string {
  return [
    d.title,
    d.stage_name,
    d.contact_name,
    d.company_name,
    d.owner_name,
    d.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Searchable deals table — filters by title, stage, contact/company, status. */
export function DealsList({ deals }: { deals: DealRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm ? deals.filter((d) => haystack(d).includes(norm)) : deals;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search deals…"
          label="Search deals"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${deals.length}`
            : `${deals.length} ${deals.length === 1 ? "deal" : "deals"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No deals match “{query.trim()}”.
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Deal</th>
                  <th className="px-4 py-3 font-medium text-muted">Stage</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Contact / Company
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Lead owner
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Follow-up due
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Value
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Event date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((d) => {
                  const who =
                    [d.contact_name, d.company_name]
                      .filter(Boolean)
                      .join(" · ") || "—";
                  return (
                    <tr key={d.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/crm/deals/${d.id}`}
                          className="font-medium text-navy underline-offset-2 transition hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {d.stage_name ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-ink">{who}</td>
                      <td className="px-4 py-3 text-ink">
                        {d.owner_name ?? (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(d.follow_up_date)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink">
                        {formatMoney(d.estimated_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatDate(d.expected_event_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
