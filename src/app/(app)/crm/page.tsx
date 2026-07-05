import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import {
  listPipeline,
  listContactOptions,
  listCompanyOptions,
  listPipelineStages,
  listAdminOptions,
} from "@/lib/crm/queries";
import { listAffiliateOptions } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { DealForm } from "@/components/crm/deal-form";

export const metadata: Metadata = { title: "Pipeline" };

export default async function CrmPipelinePage() {
  await requireView("crm");

  const [columns, contacts, companies, stages, admins, affiliates] =
    await Promise.all([
      listPipeline(),
      listContactOptions(),
      listCompanyOptions(),
      listPipelineStages(),
      listAdminOptions(),
      listAffiliateOptions(),
    ]);

  const stageOptions = stages.map((s) => ({ id: s.id, label: s.name }));

  const totalDeals = columns.reduce((n, c) => n + c.deals.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Pipeline"
        description="Track inquiries through stages from New Inquiry to Won, and convert won deals into events."
        action={
          <DealForm
            contacts={contacts}
            companies={companies}
            stages={stageOptions}
            admins={admins}
            affiliates={affiliates}
          />
        }
      />

      {totalDeals === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No deals yet. Create your first deal to start the pipeline.
        </p>
      ) : (
        <PipelineBoard columns={columns} />
      )}
    </>
  );
}
