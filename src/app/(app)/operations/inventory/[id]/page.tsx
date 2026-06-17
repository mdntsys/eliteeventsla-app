import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getInventoryItem } from "@/lib/inventory/queries";
import { PageHeader } from "@/components/ui/page-header";
import { KindBadge } from "@/components/inventory/status-badge";
import { ItemStatusControl } from "@/components/inventory/item-status-control";
import { UnitsPanel } from "@/components/inventory/units-panel";
import { MaintenancePanel } from "@/components/inventory/maintenance-panel";

export const metadata: Metadata = { title: "Inventory item" };

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
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
  await requireModule("operations");
  const { id } = await params;
  const item = await getInventoryItem(id);
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

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="SKU">{item.sku ?? "—"}</SummaryField>
            <SummaryField label="Location">{item.location ?? "—"}</SummaryField>
            <SummaryField label="Daily rate">
              {formatCurrency(item.daily_rate)}
            </SummaryField>
            <SummaryField label="Replacement cost">
              {formatCurrency(item.replacement_cost)}
            </SummaryField>
          </div>

          {item.kind === "bulk" && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="eyebrow">Quantity on hand</p>
              <p className="font-display mt-1 text-4xl font-light text-navy">
                {item.quantity}
              </p>
            </div>
          )}
        </section>

        {item.kind === "serialized" && <UnitsPanel item={item} />}

        <MaintenancePanel item={item} />
      </div>
    </>
  );
}
