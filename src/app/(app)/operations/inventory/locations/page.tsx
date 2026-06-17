import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listLocationsWithRows } from "@/lib/locations/queries";
import { LocationsManager } from "@/components/inventory/locations-manager";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  await requireModule("operations");

  const locations = await listLocationsWithRows();

  return (
    <>
      <PageHeader
        eyebrow="Operations / Inventory"
        title="Locations"
        description="Where equipment lives — warehouses with rows and offsite spots. Used when assigning items and units."
        action={
          <Link
            href="/operations/inventory"
            className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            Back to inventory
          </Link>
        }
      />

      <LocationsManager locations={locations} />
    </>
  );
}
