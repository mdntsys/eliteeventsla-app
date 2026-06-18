"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContactListRow } from "@/lib/crm/types";
import { SearchField } from "@/components/shared/search-field";

function fullName(row: ContactListRow): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
}

function haystack(row: ContactListRow): string {
  return [fullName(row), row.company_name, row.title, row.email, row.phone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Searchable contacts table — filters by name, company, title, email, phone. */
export function ContactsList({ rows }: { rows: ContactListRow[] }) {
  const [query, setQuery] = useState("");
  const norm = query.trim().toLowerCase();
  const filtered = norm ? rows.filter((r) => haystack(r).includes(norm)) : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search contacts…"
          label="Search contacts"
        />
        <p className="text-sm text-muted">
          {norm
            ? `${filtered.length} of ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "contact" : "contacts"}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No contacts match “{query.trim()}”.
        </p>
      ) : (
        <ContactTable rows={filtered} />
      )}
    </div>
  );
}

function ContactTable({ rows }: { rows: ContactListRow[] }) {
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
                <span className="eyebrow">Company</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Title</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Contact</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Open deals</span>
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
                    href={`/crm/contacts/${row.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {fullName(row) || "Unnamed contact"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.company_name ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.title ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ContactCell email={row.email} phone={row.phone} />
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {row.open_deals}
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
