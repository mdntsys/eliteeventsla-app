import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import {
  listContacts,
  listCompanyOptions,
  listStaffOptions,
} from "@/lib/crm/queries";
import type { ContactListRow } from "@/lib/crm/types";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "@/components/crm/contact-form";

export const metadata: Metadata = { title: "Contacts" };

function fullName(row: ContactListRow): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
}

export default async function ContactsPage() {
  await requireModule("crm");

  const [rows, companies, staff] = await Promise.all([
    listContacts(),
    listCompanyOptions(),
    listStaffOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Contacts"
        description="People you work with — leads and clients, optionally linked to a company."
        action={<ContactForm companies={companies} staff={staff} />}
      />

      <div className="flex flex-col gap-6">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "contact" : "contacts"}
            </p>
            <ContactTable rows={rows} />
          </>
        )}
      </div>
    </>
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

function EmptyState() {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No contacts yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Start your contact list
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first lead or client — link them to a company, capture their
        details, then track deals and activity against them.
      </p>
    </div>
  );
}
