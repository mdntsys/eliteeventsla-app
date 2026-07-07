import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listInventory, listCategories } from "@/lib/inventory/queries";
import { listLocationOptions } from "@/lib/locations/queries";
import { listEventOptions } from "@/lib/events/queries";
import { InventoryBrowser } from "@/components/inventory/inventory-browser";
import { NewItemForm } from "@/components/inventory/new-item-form";
import { CsvImport } from "@/components/inventory/csv-import";
import { CsvExport } from "@/components/inventory/csv-export";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireView("inventory");

  const [rows, categories, locationOptions, events] = await Promise.all([
    listInventory(),
    listCategories(),
    listLocationOptions(),
    listEventOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Equipment and machines — bulk stock by quantity plus individually tracked serialized units, with availability and maintenance."
        action={
          <Link
            href="/operations/inventory/locations"
            className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-card"
          >
            Manage locations
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState categories={categories} locationOptions={locationOptions} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <CsvExport rows={rows} />
            <CsvImport />
            <NewItemForm
              categories={categories}
              locationOptions={locationOptions}
            />
          </div>
          <InventoryBrowser
            rows={rows}
            events={events}
            locationOptions={locationOptions}
          />
        </div>
      )}
    </>
  );
}

function EmptyState({
  categories,
  locationOptions,
}: {
  categories: Awaited<ReturnType<typeof listCategories>>;
  locationOptions: Awaited<ReturnType<typeof listLocationOptions>>;
}) {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No items yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Start building your inventory
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first piece of equipment. Track it as bulk stock by quantity,
        or as a serialized asset with individually tagged units.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <CsvImport />
        <NewItemForm
          categories={categories}
          locationOptions={locationOptions}
        />
      </div>
    </div>
  );
}
