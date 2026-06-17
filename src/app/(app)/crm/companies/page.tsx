import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  await requireModule("crm");
  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Companies"
        description="Organizations — corporate clients and accounts that group multiple contacts and deals."
      />
      <ModulePlaceholder
        items={[
          "Company directory",
          "Contacts under a company",
          "Deals & events rollup",
          "Industry & address details",
          "Owner assignment",
          "Notes & activity log",
        ]}
      />
    </>
  );
}
