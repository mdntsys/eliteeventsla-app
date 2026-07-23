import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InventoryKit,
  KitDetail,
  KitLine,
  KitListRow,
} from "@/lib/inventory/kit-types";

/**
 * Inventory bundles ("kits") — a named, located set of items that gets pulled,
 * reserved, and loaded as one unit (e.g. "Photo Booth A": the whole pallet).
 *
 * A kit line is (item, quantity), not one row per physical thing: most of this
 * inventory is bulk, so a 20-count box of scarves can split 10/10 across two
 * kits — the same item appears in both with different quantities. `unit_id`
 * pins a specific serialized asset (that pallet's actual booth machine).
 *
 * Reserving a kit writes ordinary `event_items` rows, so availability, the
 * double-booking guard, the pick list, and check-out/return all keep working.
 *
 * Shapes live in @/lib/inventory/kit-types so the client screens can import
 * them without pulling this server-only module into the browser bundle.
 */

type KitRowJoins = InventoryKit & {
  locations: { name: string } | null;
  warehouse_rows: { label: string } | null;
  inventory_kit_items: { id: string; quantity: number }[] | null;
};

function toListRow(kit: KitRowJoins): KitListRow {
  const lines = kit.inventory_kit_items ?? [];
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const { locations, warehouse_rows, inventory_kit_items, ...rest } = kit;
  return {
    ...rest,
    location_name: locations?.name ?? null,
    row_label: warehouse_rows?.label ?? null,
    line_count: lines.length,
    piece_count: lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0),
  };
}

/** Every bundle, ordered as configured then by name. */
export async function listKits(): Promise<KitListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_kits")
    .select(
      "*, locations(name), warehouse_rows(label), inventory_kit_items(id, quantity)",
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as KitRowJoins[]).map(toListRow);
}

/** Active bundles only — what the event hub offers for reservation. */
export async function listActiveKits(): Promise<KitListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_kits")
    .select(
      "*, locations(name), warehouse_rows(label), inventory_kit_items(id, quantity)",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as KitRowJoins[]).map(toListRow);
}

/** One bundle with its contents, or null if it doesn't exist / isn't visible. */
export async function getKit(id: string): Promise<KitDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_kits")
    .select(
      "*, locations(name), warehouse_rows(label), inventory_kit_items(id, quantity)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: lineData, error: lineError } = await supabase
    .from("inventory_kit_items")
    .select(
      "id, item_id, unit_id, quantity, notes, inventory_items(name, sku, kind, quantity), inventory_units(asset_tag)",
    )
    .eq("kit_id", id);

  if (lineError) throw new Error(lineError.message);

  // Serialized stock has no meaningful `inventory_items.quantity` (it stays 0);
  // its on-hand figure is the number of units that exist. Without this every
  // serialized line reads "0 on hand" and gets flagged as over-committed.
  const serializedIds = ((lineData ?? []) as unknown as { item_id: string;
    inventory_items: { kind: string } | null }[])
    .filter((l) => l.inventory_items?.kind === "serialized")
    .map((l) => l.item_id);

  const unitCounts = new Map<string, number>();
  if (serializedIds.length > 0) {
    const { data: unitRows, error: unitError } = await supabase
      .from("inventory_units")
      .select("item_id")
      .in("item_id", Array.from(new Set(serializedIds)))
      .neq("status", "retired");
    if (unitError) throw new Error(unitError.message);
    for (const u of (unitRows ?? []) as { item_id: string }[]) {
      unitCounts.set(u.item_id, (unitCounts.get(u.item_id) ?? 0) + 1);
    }
  }

  type LineJoins = {
    id: string;
    item_id: string;
    unit_id: string | null;
    quantity: number;
    notes: string | null;
    inventory_items: {
      name: string;
      sku: string | null;
      kind: "bulk" | "serialized";
      quantity: number;
    } | null;
    inventory_units: { asset_tag: string | null } | null;
  };

  const lines: KitLine[] = ((lineData ?? []) as unknown as LineJoins[])
    .map((l) => ({
      id: l.id,
      item_id: l.item_id,
      unit_id: l.unit_id,
      quantity: l.quantity,
      notes: l.notes,
      item_name: l.inventory_items?.name ?? "Unknown item",
      item_sku: l.inventory_items?.sku ?? null,
      item_kind: l.inventory_items?.kind ?? "bulk",
      item_on_hand:
        l.inventory_items?.kind === "serialized"
          ? (unitCounts.get(l.item_id) ?? 0)
          : (l.inventory_items?.quantity ?? 0),
      unit_asset_tag: l.inventory_units?.asset_tag ?? null,
    }))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  return { ...toListRow(data as unknown as KitRowJoins), lines };
}

/** id + name for a picker, active bundles only. */
export async function listKitOptions(): Promise<
  { id: string; label: string }[]
> {
  const kits = await listActiveKits();
  return kits.map((k) => ({ id: k.id, label: k.name }));
}
