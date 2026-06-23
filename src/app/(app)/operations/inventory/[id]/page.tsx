import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getInventoryItem } from "@/lib/inventory/queries";
import { listLocationOptions } from "@/lib/locations/queries";
import { PageHeader } from "@/components/ui/page-header";
import { KindBadge } from "@/components/inventory/status-badge";
import { ItemStatusControl } from "@/components/inventory/item-status-control";
import { ItemLocationForm } from "@/components/inventory/item-location-form";
import { UnitsPanel } from "@/components/inventory/units-panel";
import { MaintenancePanel } from "@/components/inventory/maintenance-panel";
import { ImageUpload } from "@/components/shared/image-upload";

export const metadata: Metadata = { title: "Inventory item" };

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatLocation(
  name: string | null,
  rowLabel: string | null,
  section: string | null,
): string {
  if (!name) return "—";
  const parts = [name];
  if (rowLabel) parts.push(`Row ${rowLabel}`);
  if (section) parts.push(`Section ${section}`);
  return parts.join(" · ");
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("inventory");
  const { id } = await params;
  const [item, locationOptions] = await Promise.all([
    getInventoryItem(id),
    listLocationOptions(),
  ]);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Operations / Inventory"
        title={item.name}
        description={item.description ?? undefined}
        action={
          <Link
            href="/operations/inventory"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Back to inventory
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <KindBadge kind={item.kind} />
              {item.category_name && (
                <span className="text-sm text-muted">
                  {item.category_name}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="eyebrow">Status</span>
              <ItemStatusControl itemId={item.id} status={item.status} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div>
              <ImageUpload
                kind="item"
                targetId={item.id}
                itemId={item.id}
                currentUrl={item.image_url}
                label="Item photo"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <SummaryField label="SKU">{item.sku ?? "—"}</SummaryField>
              <SummaryField label="Location">
                {formatLocation(
                  item.location_name,
                  item.row_label,
                  item.section,
                )}
              </SummaryField>
              <SummaryField label="Daily rate">
                {formatCurrency(item.daily_rate)}
              </SummaryField>
              <SummaryField label="Replacement cost">
                {formatCurrency(item.replacement_cost)}
              </SummaryField>
            </div>
          </div>

          {item.kind === "bulk" && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="eyebrow">Quantity on hand</p>
              <p className="font-display mt-1 text-4xl font-light text-navy">
                {item.quantity}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-line pt-6">
            <p className="eyebrow mb-3">Edit location</p>
            <ItemLocationForm
              itemId={item.id}
              options={locationOptions}
              defaultLocationId={item.location_id}
              defaultRowId={item.row_id}
              defaultSection={item.section}
            />
          </div>
        </section>

        {item.kind === "serialized" && (
          <UnitsPanel item={item} locationOptions={locationOptions} />
        )}

        <MaintenancePanel item={item} />
      </div>
    </>
  );
}
