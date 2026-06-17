import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Scheduling" };

export default async function SchedulingPage() {
  await requireModule("operations");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Scheduling"
        description="Deliveries, pickups, setups, and teardowns for each event, with staff assignments."
      />
      <ModulePlaceholder
        items={[
          "Calendar of schedule entries",
          "Delivery / pickup / setup / teardown",
          "Assign staff to entries",
          "Status: scheduled → en route → done",
          "Per-event timeline",
          "Conflict & capacity warnings",
        ]}
      />
    </>
  );
}
