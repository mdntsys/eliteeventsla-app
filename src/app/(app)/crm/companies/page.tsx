import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listCompanies, listStaffOptions } from "@/lib/crm/queries";
import type { CompanyListRow } from "@/lib/crm/types";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "@/components/crm/company-form";

export const metadata: Metadata = { title: "Companies" };

function location(row: CompanyListRow): string | null {
  const parts = [row.city, row.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export default async function CompaniesPage() {
  await requireModule("crm");

  const [rows, staff] = await Promise.all([
    listCompanies(),
    listStaffOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Companies"
        description="Organizations — corporate clients and accounts that group multiple contacts and deals."
        action={<CompanyForm staff={staff} />}
      />

      <div className="flex flex-col gap-6">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "company" : "companies"}
            </p>
            <CompanyTable rows={rows} />
          </>
        )}
      </div>
    </>
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

function EmptyState() {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No companies yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Build your account directory
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first organization — a corporate client or account — then group
        contacts and deals under it.
      </p>
    </div>
  );
}
