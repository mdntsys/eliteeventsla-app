import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import { listCompanies } from "@/lib/crm/queries";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "@/components/crm/company-form";
import { CompaniesList } from "@/components/crm/companies-list";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  await requireView("crm");

  const rows = await listCompanies();

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Companies"
        description="Organizations — corporate clients and accounts that group multiple contacts and deals."
        action={<CompanyForm />}
      />

      <div className="flex flex-col gap-6">
        {rows.length === 0 ? <EmptyState /> : <CompaniesList rows={rows} />}
      </div>
    </>
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
