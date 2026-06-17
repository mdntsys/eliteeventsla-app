import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Accounting" };

export default async function AccountingOverviewPage() {
  await requireModule("accounting");
  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Overview"
        description="Money at a glance — outstanding balances, recent payments, and jobs awaiting reconciliation."
      />
      <ModulePlaceholder
        items={[
          "Outstanding vs. paid totals",
          "Overdue invoices",
          "Recent Stripe payments",
          "Unreconciled jobs",
          "Revenue by period",
          "Quick send payment link",
        ]}
      />
    </>
  );
}
