"use client";

import { useState } from "react";
import Link from "next/link";
import type { AffiliateRow } from "@/lib/affiliates/types";
import { SearchField } from "@/components/shared/search-field";

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-line bg-cream text-muted"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function haystack(a: AffiliateRow): string {
  return [a.full_name, a.email, a.phone, a.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Searchable affiliates table — name, contact, commission rate, status. */
export function AffiliatesList({ affiliates }: { affiliates: AffiliateRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm
    ? affiliates.filter((a) => haystack(a).includes(norm))
    : affiliates;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search affiliates…"
          label="Search affiliates"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${affiliates.length}`
            : `${affiliates.length} ${affiliates.length === 1 ? "affiliate" : "affiliates"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          {norm ? `No affiliates match “${query.trim()}”.` : "No affiliates yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Affiliate</th>
                  <th className="px-4 py-3 font-medium text-muted">Contact</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Commission
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/affiliates/${a.id}`}
                        className="font-medium text-navy underline-offset-2 transition hover:underline"
                      >
                        {a.full_name ?? "Unnamed affiliate"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {a.email ?? "—"}
                      {a.phone ? (
                        <span className="block text-xs text-muted">
                          {a.phone}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {formatPct(a.commission_rate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
