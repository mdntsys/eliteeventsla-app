import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Events & Jobs" };

export default async function EventsPage() {
  await requireModule("events");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Events & Jobs"
        description="The central operational record — created from a won deal, tying together inventory, scheduling, vendors, and billing."
      />
      <ModulePlaceholder
        items={[
          "Event list with status & date",
          "Reserved inventory line items",
          "Delivery / pickup / setup schedule",
          "Assigned vendors & staff",
          "Venue, guest count, totals",
          "Linked invoices & payments",
        ]}
      />
    </>
  );
}
