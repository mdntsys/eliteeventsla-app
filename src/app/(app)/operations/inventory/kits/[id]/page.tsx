import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { getKit } from "@/lib/inventory/kits";
import { kitLocationLabel } from "@/lib/inventory/kit-types";
import { listInventory } from "@/lib/inventory/queries";
import { listLocationOptions } from "@/lib/locations/queries";
import { KitDetailView } from "@/components/inventory/kit-detail";

export const metadata: Metadata = { title: "Bundle" };

export default async function KitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireView("inventory");
  const { id } = await params;

  const kit = await getKit(id);
  if (!kit) notFound();

  const [items, locationOptions] = await Promise.all([
    listInventory(),
    listLocationOptions(),
  ]);

  const where = kitLocationLabel(kit);

  return (
    <>
      <PageHeader
        eyebrow="Operations / Inventory / Bundles"
        title={kit.name}
        description={
          [kit.description, where ? `Stored at ${where}` : null]
            .filter(Boolean)
            .join(" · ") || "No location set yet."
        }
        action={
          <Link
            href="/operations/inventory/kits"
            className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            All bundles
          </Link>
        }
      />

      <KitDetailView
        kit={kit}
        items={items}
        locationOptions={locationOptions}
        canEdit={canEdit(profile, "inventory")}
      />
    </>
  );
}
