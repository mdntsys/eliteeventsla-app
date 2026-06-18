"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompanyListRow } from "@/lib/crm/types";
import { SearchField } from "@/components/shared/search-field";

function location(row: CompanyListRow): string | null {
  const parts = [row.city, row.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function haystack(row: CompanyListRow): string {
  return [row.name, row.industry, row.city, row.state]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Searchable companies table — filters by name, industry, city, state. */
export function CompaniesList({ rows }: { rows: CompanyListRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm ? rows.filter((r) => haystack(r).includes(norm)) : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search companies…"
          label="Search companies"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "company" : "companies"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No companies match “{query.trim()}”.
        </p>
      ) : (
        <CompanyTable rows={filtered} />
      )}
    </div>
  );
}

function CompanyTable({ rows }: { rows: CompanyListRow[] }) {
  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Name</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Industry</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Location</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Contacts</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Deals</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line transition last:border-b-0 hover:bg-cream"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/crm/companies/${row.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.industry ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-ink">
                  {location(row) ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {row.contact_count}
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {row.deal_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
