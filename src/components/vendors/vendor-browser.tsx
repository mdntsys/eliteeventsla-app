"use client";

import { useState } from "react";
import Link from "next/link";
import type { VendorListRow } from "@/lib/vendors/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import { RatingStars } from "@/components/vendors/rating-stars";
import { SearchField } from "@/components/shared/search-field";

function haystack(row: VendorListRow): string {
  return [row.name, row.category_name, row.email, row.phone, row.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Instant search over the (already category-filtered) vendor directory. */
export function VendorBrowser({ rows }: { rows: VendorListRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm ? rows.filter((r) => haystack(r).includes(norm)) : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search vendors…"
          label="Search vendors"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "vendor" : "vendors"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No vendors match “{query.trim()}”.
        </p>
      ) : (
        <VendorTable rows={filtered} />
      )}
    </div>
  );
}

function VendorTable({ rows }: { rows: VendorListRow[] }) {
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
                <span className="eyebrow">Category</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Rating</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Contact</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Status</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Events</span>
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
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/operations/vendors/${row.id}`}
                      className="font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.preferred && <PreferredBadge />}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.category_name ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <RatingStars rating={row.rating} />
                </td>
                <td className="px-4 py-3">
                  <ContactCell email={row.email} phone={row.phone} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {row.event_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactCell({
  email,
  phone,
}: {
  email: string | null;
  phone: string | null;
}) {
  if (!email && !phone) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {email && (
        <a
          href={`mailto:${email}`}
          className="text-navy underline-offset-2 hover:underline"
        >
          {email}
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {phone}
        </a>
      )}
    </div>
  );
}

function PreferredBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      Preferred
    </span>
  );
}
