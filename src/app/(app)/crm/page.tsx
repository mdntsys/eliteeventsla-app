import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Pipeline" };

export default async function CrmPipelinePage() {
  await requireModule("crm");
  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Pipeline"
        description="Track inquiries through stages from New Inquiry to Won, and convert won deals into events."
      />
      <ModulePlaceholder
        items={[
          "Kanban board by pipeline stage",
          "Drag deals between stages",
          "Deal value & expected event date",
          "Convert won deal → event/job",
          "Owner & source filters",
          "Stage configuration (admin)",
        ]}
      />
    </>
  );
}
