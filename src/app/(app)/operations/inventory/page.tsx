import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listInventory, listCategories } from "@/lib/inventory/queries";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { NewItemForm } from "@/components/inventory/new-item-form";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireModule("operations");

  const [rows, categories] = await Promise.all([
    listInventory(),
    listCategories(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Equipment and machines — bulk stock by quantity plus individually tracked serialized units, with availability and maintenance."
      />

      {rows.length === 0 ? (
        <EmptyState categories={categories} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </p>
            <NewItemForm categories={categories} />
          </div>
          <InventoryTable rows={rows} />
        </div>
      )}
    </>
  );
}

function EmptyState({
  categories,
}: {
  categories: Awaited<ReturnType<typeof listCategories>>;
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
      <div className="mt-6 flex justify-center">
        <NewItemForm categories={categories} />
      </div>
    </div>
  );
}
