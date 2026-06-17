import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  await requireModule("crm");
  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Deals"
        description="The full deal list with stage, value, and expected event date — the table view behind the pipeline."
      />
      <ModulePlaceholder
        items={[
          "Sortable/filterable deals table",
          "Stage, status (open/won/lost)",
          "Estimated value & event type",
          "Linked contact & company",
          "Follow-ups & activities",
          "Convert to event/job",
        ]}
      />
    </>
  );
}
