import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listScheduleInRange } from "@/lib/events/queries";
import { ScheduleAgenda } from "@/components/events/schedule-agenda";

export const metadata: Metadata = { title: "Scheduling" };

const RANGE_DAYS = 21;

export default async function SchedulingPage() {
  await requireModule("operations");

  // Window: from the start of today through ~21 days out. Computed at request
  // time on the server; the agenda formats day/time in the viewer's locale.
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + RANGE_DAYS);

  const entries = await listScheduleInRange(from.toISOString(), to.toISOString());

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Scheduling"
        description="Deliveries, pickups, setups, and teardowns across every job for the next three weeks."
      />
      <ScheduleAgenda entries={entries} />
    </>
  );
}
