import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import {
  listDeals,
  listContactOptions,
  listCompanyOptions,
  listPipelineStages,
  listAdminOptions,
} from "@/lib/crm/queries";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "@/components/crm/deal-form";
import { DealsList } from "@/components/crm/deals-list";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  await requireView("crm");

  const [deals, contacts, companies, stages, admins] = await Promise.all([
    listDeals(),
    listContactOptions(),
    listCompanyOptions(),
    listPipelineStages(),
    listAdminOptions(),
  ]);

  const stageOptions = stages.map((s) => ({ id: s.id, label: s.name }));

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Deals"
        description="The full deal list with stage, value, and expected event date — the table view behind the pipeline."
        action={
          <DealForm
            contacts={contacts}
            companies={companies}
            stages={stageOptions}
            admins={admins}
          />
        }
      />

      {deals.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No deals yet.
        </p>
      ) : (
        <DealsList deals={deals} />
      )}
    </>
  );
}
