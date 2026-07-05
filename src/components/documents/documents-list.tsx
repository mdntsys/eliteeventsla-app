"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentRow } from "@/lib/documents/types";
import { SearchField } from "@/components/shared/search-field";

const KIND_LABELS: Record<string, string> = {
  affiliate_contract: "Affiliate contract",
  customer_sow: "Customer SOW",
  other: "Document",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-line bg-cream-deep text-muted",
  sent: "border-amber-200 bg-amber-50 text-amber-700",
  viewed: "border-amber-200 bg-amber-50 text-amber-700",
  signed: "border-green-200 bg-green-50 text-green-700",
  voided: "border-line bg-cream-deep text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  voided: "Voided",
};

function StatusPill({ status }: { status: string }) {
  const className =
    STATUS_STYLES[status] ?? "border-line bg-cream-deep text-muted";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function haystack(d: DocumentRow): string {
  return [d.title, d.affiliate_name, d.event_title, d.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Searchable documents table — filters by title, party, and status. */
export function DocumentsList({ documents }: { documents: DocumentRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm
    ? documents.filter((d) => haystack(d).includes(norm))
    : documents;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search documents…"
          label="Search documents"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${documents.length}`
            : `${documents.length} ${documents.length === 1 ? "document" : "documents"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          {norm
            ? `No documents match “${query.trim()}”.`
            : "No documents yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Document</th>
                  <th className="px-4 py-3 font-medium text-muted">Kind</th>
                  <th className="px-4 py-3 font-medium text-muted">For</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-muted">Signer</th>
                  <th className="px-4 py-3 font-medium text-muted">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((d) => (
                  <tr key={d.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${d.id}`}
                        className="font-medium text-navy underline-offset-2 transition hover:underline"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {KIND_LABELS[d.kind] ?? "Document"}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {d.affiliate_name ?? d.event_title ?? (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {d.signer_name ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(d.created_at)}
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
