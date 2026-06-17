import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireModule("operations");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Equipment and machines — bulk stock by quantity plus individually tracked serialized units, with availability and maintenance."
      />
      <ModulePlaceholder
        items={[
          "Items by category (bulk & serialized)",
          "Bulk quantity & per-unit asset tags",
          "Availability vs. reserved windows",
          "Maintenance log & status",
          "Daily rate & replacement cost",
          "Item photos (Supabase Storage)",
        ]}
      />
    </>
  );
}
