import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemDetail,
  InventoryListRow,
  InventoryUnit,
  MaintenanceRecord,
} from "@/lib/inventory/types";

/** All inventory categories, alphabetical. */
export async function listCategories(): Promise<InventoryCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every inventory item with its category name and computed aggregates:
 * unit_count, available_units (units with status 'available'), and
 * open_maintenance (maintenance rows with status != 'resolved' attached to the
 * item or any of its units). We fetch items+categories, all units, and all
 * unresolved maintenance, then aggregate in JS.
 */
export async function listInventory(): Promise<InventoryListRow[]> {
  const supabase = await createClient();

  const [itemsRes, unitsRes, maintRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*, inventory_categories(name)")
      .order("name", { ascending: true }),
    supabase.from("inventory_units").select("id, item_id, status"),
    supabase
      .from("maintenance_records")
      .select("id, item_id, unit_id, status")
      .neq("status", "resolved"),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (unitsRes.error) throw new Error(unitsRes.error.message);
  if (maintRes.error) throw new Error(maintRes.error.message);

  type ItemWithCategory = InventoryItem & {
    inventory_categories: { name: string } | null;
  };

  const items = (itemsRes.data ?? []) as ItemWithCategory[];
  const units = unitsRes.data ?? [];
  const maintenance = maintRes.data ?? [];

  // unit_id -> item_id, so unit-attached maintenance counts toward its item.
  const unitToItem = new Map<string, string>();
  for (const unit of units) {
    unitToItem.set(unit.id, unit.item_id);
  }

  // Per-item unit aggregates.
  const unitCounts = new Map<string, number>();
  const availableCounts = new Map<string, number>();
  for (const unit of units) {
    unitCounts.set(unit.item_id, (unitCounts.get(unit.item_id) ?? 0) + 1);
    if (unit.status === "available") {
      availableCounts.set(
        unit.item_id,
        (availableCounts.get(unit.item_id) ?? 0) + 1,
      );
    }
  }

  // Per-item open-maintenance counts (resolve unit_id back to its item).
  const openMaintenance = new Map<string, number>();
  for (const rec of maintenance) {
    const itemId =
      rec.item_id ?? (rec.unit_id ? unitToItem.get(rec.unit_id) : undefined);
    if (!itemId) continue;
    openMaintenance.set(itemId, (openMaintenance.get(itemId) ?? 0) + 1);
  }

  return items.map((item) => {
    const { inventory_categories, ...rest } = item;
    return {
      ...rest,
      category_name: inventory_categories?.name ?? null,
      unit_count: unitCounts.get(item.id) ?? 0,
      available_units: availableCounts.get(item.id) ?? 0,
      open_maintenance: openMaintenance.get(item.id) ?? 0,
    };
  });
}

/**
 * A single item with its category name, its units (oldest first), and all
 * maintenance attached to the item OR any of its units, newest first. Returns
 * null if the item does not exist (or is not visible under RLS).
 */
export async function getInventoryItem(
  id: string,
): Promise<InventoryItemDetail | null> {
  const supabase = await createClient();

  const { data: itemData, error: itemError } = await supabase
    .from("inventory_items")
    .select("*, inventory_categories(name)")
    .eq("id", id)
    .maybeSingle();

  if (itemError) throw new Error(itemError.message);
  if (!itemData) return null;

  const { inventory_categories, ...item } = itemData as InventoryItem & {
    inventory_categories: { name: string } | null;
  };

  const { data: unitsData, error: unitsError } = await supabase
    .from("inventory_units")
    .select("*")
    .eq("item_id", id)
    .order("created_at", { ascending: true });

  if (unitsError) throw new Error(unitsError.message);
  const units = (unitsData ?? []) as InventoryUnit[];

  // Maintenance attached to the item or any of its units.
  const unitIds = units.map((u) => u.id);
  const orParts = [`item_id.eq.${id}`];
  if (unitIds.length > 0) {
    orParts.push(`unit_id.in.(${unitIds.join(",")})`);
  }

  const { data: maintData, error: maintError } = await supabase
    .from("maintenance_records")
    .select("*")
    .or(orParts.join(","))
    .order("reported_at", { ascending: false });

  if (maintError) throw new Error(maintError.message);
  const maintenance = (maintData ?? []) as MaintenanceRecord[];

  return {
    ...item,
    category_name: inventory_categories?.name ?? null,
    units,
    maintenance,
  };
}
