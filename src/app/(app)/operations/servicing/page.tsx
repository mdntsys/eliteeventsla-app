import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Servicing" };

export default async function ServicingPage() {
  await requireModule("operations");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Client Servicing"
        description="Service tickets for clients and events — questions, issues, and follow-through during and after a job."
      />
      <ModulePlaceholder
        items={[
          "Ticket queue by status & priority",
          "Link ticket to event or contact",
          "Assign to a team member",
          "Resolution tracking",
          "Activity & comments",
          "SLA / response time view",
        ]}
      />
    </>
  );
}
