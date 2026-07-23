import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { listKits } from "@/lib/inventory/kits";
import { listLocationOptions } from "@/lib/locations/queries";
import { KitsManager } from "@/components/inventory/kits-manager";

export const metadata: Metadata = { title: "Bundles" };

export default async function KitsPage() {
  const profile = await requireView("inventory");

  const [kits, locationOptions] = await Promise.all([
    listKits(),
    listLocationOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations / Inventory"
        title="Bundles"
        description="Pallets of gear that get pulled, booked, and loaded as one — so a crew member takes “Photo Booth A” instead of picking thirty items."
        action={
          <Link
            href="/operations/inventory"
            className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            Back to inventory
          </Link>
        }
      />

      <KitsManager
        kits={kits}
        locationOptions={locationOptions}
        canEdit={canEdit(profile, "inventory")}
      />
    </>
  );
}
