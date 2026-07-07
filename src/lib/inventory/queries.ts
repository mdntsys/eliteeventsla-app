import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InventoryCategory,
  InventoryItem,
  InventoryItemDetail,
  InventoryListRow,
  InventoryUnit,
  InventoryUnitView,
  MaintenanceRecord,
} from "@/lib/inventory/types";

/**
 * Format a human location label from its parts. Examples:
 *   "Alvy Warehouse · Row A · §3"
 *   "Alvy Warehouse · Row A"
 *   "Alvy Warehouse"
 *   "Delia's House · §3"
 * Returns null when there is no location name at all.
 */
function formatLocationLabel(
  locationName: string | null,
  rowLabel: string | null,
  section: string | null,
): string | null {
  const parts: string[] = [];
  if (locationName) parts.push(locationName);
  if (rowLabel) parts.push(rowLabel);
  if (section) parts.push(`§${section}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

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

  const [itemsRes, unitsRes, maintRes, locationsRes, rowsRes, reservationsRes] =
    await Promise.all([
      supabase
        .from("inventory_items")
        .select("*, inventory_categories(name)")
        .order("name", { ascending: true }),
      supabase
        .from("inventory_units")
        .select("id, item_id, asset_tag, status, location_id, row_id, section"),
      supabase
        .from("maintenance_records")
        .select("id, item_id, unit_id, status")
        .neq("status", "resolved"),
      supabase.from("locations").select("id, name"),
      supabase.from("warehouse_rows").select("id, label"),
      // Live reservations, for the "in use right now" snapshot on the list.
      supabase
        .from("event_items")
        .select(
          "inventory_item_id, unit_id, quantity, reserved_from, reserved_to, checked_out_at, events(title)",
        )
        .is("returned_at", null),
    ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (unitsRes.error) throw new Error(unitsRes.error.message);
  if (maintRes.error) throw new Error(maintRes.error.message);
  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);

  type ItemWithCategory = InventoryItem & {
    inventory_categories: { name: string } | null;
  };

  const items = (itemsRes.data ?? []) as ItemWithCategory[];
  const units = unitsRes.data ?? [];
  const maintenance = maintRes.data ?? [];

  // Lookup maps for resolving location/row labels.
  const locationNames = new Map<string, string>();
  for (const loc of locationsRes.data ?? []) {
    locationNames.set(loc.id, loc.name);
  }
  const rowLabels = new Map<string, string>();
  for (const row of rowsRes.data ?? []) {
    rowLabels.set(row.id, row.label);
  }

  // unit_id -> item_id, so unit-attached maintenance counts toward its item.
  const unitToItem = new Map<string, string>();
  for (const unit of units) {
    unitToItem.set(unit.id, unit.item_id);
  }

  // Per-item unit aggregates + the available serialized units offered in the
  // "reserve for an event" picker.
  const unitCounts = new Map<string, number>();
  const availableCounts = new Map<string, number>();
  const availableUnitOptions = new Map<string, { id: string; asset_tag: string | null }[]>();
  for (const unit of units) {
    unitCounts.set(unit.item_id, (unitCounts.get(unit.item_id) ?? 0) + 1);
    if (unit.status === "available") {
      availableCounts.set(
        unit.item_id,
        (availableCounts.get(unit.item_id) ?? 0) + 1,
      );
      const opts = availableUnitOptions.get(unit.item_id) ?? [];
      opts.push({ id: unit.id, asset_tag: unit.asset_tag });
      availableUnitOptions.set(unit.item_id, opts);
    }
  }

  // What's reserved (spoken for) per item: any line not yet returned that is
  // either checked out (physically out) or still upcoming/current — i.e. its
  // reserved window hasn't ended, or it has no end date. This makes reserving an
  // item for a FUTURE event immediately reduce its availability here, while a
  // stale past reservation that was never returned auto-releases once its window
  // ends. For serialized items we track the reserved-but-not-checked-out lines
  // separately so they can be netted off the available-unit count (checked-out
  // units already left the available pool via their 'in_use' status).
  const now = Date.now();
  const toMs = (iso: string | null, fallback: number): number => {
    if (!iso) return fallback;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? fallback : t;
  };
  type LiveReservation = {
    inventory_item_id: string;
    unit_id: string | null;
    quantity: number | null;
    reserved_from: string | null;
    reserved_to: string | null;
    checked_out_at: string | null;
    events: { title: string | null } | null;
  };
  const reservations = (reservationsRes.data ?? []) as LiveReservation[];
  const reservedQty = new Map<string, number>(); // committed units/qty
  const reservedNotOut = new Map<string, number>(); // reserved but not checked out
  const reservedTitles = new Map<string, Set<string>>();
  for (const r of reservations) {
    const notEnded = r.reserved_to == null || toMs(r.reserved_to, Infinity) >= now;
    const committed = r.checked_out_at != null || notEnded;
    if (!committed) continue;
    const qty = r.quantity ?? 1;
    reservedQty.set(
      r.inventory_item_id,
      (reservedQty.get(r.inventory_item_id) ?? 0) + qty,
    );
    if (r.checked_out_at == null) {
      reservedNotOut.set(
        r.inventory_item_id,
        (reservedNotOut.get(r.inventory_item_id) ?? 0) + qty,
      );
    }
    const title = r.events?.title;
    if (title) {
      const set = reservedTitles.get(r.inventory_item_id) ?? new Set<string>();
      set.add(title);
      reservedTitles.set(r.inventory_item_id, set);
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

  // For serialized items, collect the distinct location names across units (in
  // first-seen order) so we can summarize where the set physically lives.
  const unitLocationsByItem = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.location_id) continue;
    const name = locationNames.get(unit.location_id);
    if (!name) continue;
    const seen = unitLocationsByItem.get(unit.item_id) ?? [];
    if (!seen.includes(name)) {
      seen.push(name);
      unitLocationsByItem.set(unit.item_id, seen);
    }
  }

  function locationSummaryFor(item: ItemWithCategory): string | null {
    if (item.kind === "serialized") {
      const names = unitLocationsByItem.get(item.id);
      return names && names.length > 0 ? names.join(" · ") : null;
    }
    return formatLocationLabel(
      item.location_id ? (locationNames.get(item.location_id) ?? null) : null,
      item.row_id ? (rowLabels.get(item.row_id) ?? null) : null,
      item.section,
    );
  }

  return items.map((item) => {
    const { inventory_categories, ...rest } = item;
    const unitCount = unitCounts.get(item.id) ?? 0;
    const availableUnits = availableCounts.get(item.id) ?? 0;
    const reservedCount = reservedQty.get(item.id) ?? 0;
    // Available to reserve: bulk nets the reserved quantity off the on-hand
    // count; serialized nets only the reserved-not-yet-out lines off the units
    // that are already status='available' (checked-out units are already
    // excluded from availableUnits by their 'in_use' status).
    const availableCount =
      item.kind === "serialized"
        ? Math.max(0, availableUnits - (reservedNotOut.get(item.id) ?? 0))
        : Math.max(0, (item.quantity ?? 0) - reservedCount);
    return {
      ...rest,
      category_name: inventory_categories?.name ?? null,
      unit_count: unitCount,
      available_units: availableUnits,
      open_maintenance: openMaintenance.get(item.id) ?? 0,
      reserved_count: reservedCount,
      available_count: availableCount,
      reserved_event_titles: Array.from(reservedTitles.get(item.id) ?? []),
      available_unit_options: availableUnitOptions.get(item.id) ?? [],
      location_summary: locationSummaryFor(item),
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
  const rawUnits = (unitsData ?? []) as InventoryUnit[];

  // Resolve location + row labels for the item and all of its units in one shot.
  const locationIds = new Set<string>();
  const rowIds = new Set<string>();
  if (item.location_id) locationIds.add(item.location_id);
  if (item.row_id) rowIds.add(item.row_id);
  for (const unit of rawUnits) {
    if (unit.location_id) locationIds.add(unit.location_id);
    if (unit.row_id) rowIds.add(unit.row_id);
  }

  const locationNames = new Map<string, string>();
  const rowLabels = new Map<string, string>();

  const [locationsRes, rowsRes] = await Promise.all([
    locationIds.size > 0
      ? supabase
          .from("locations")
          .select("id, name")
          .in("id", Array.from(locationIds))
      : Promise.resolve({ data: [], error: null }),
    rowIds.size > 0
      ? supabase
          .from("warehouse_rows")
          .select("id, label")
          .in("id", Array.from(rowIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);

  for (const loc of locationsRes.data ?? []) locationNames.set(loc.id, loc.name);
  for (const row of rowsRes.data ?? []) rowLabels.set(row.id, row.label);

  const units: InventoryUnitView[] = rawUnits.map((unit) => ({
    ...unit,
    location_name: unit.location_id
      ? (locationNames.get(unit.location_id) ?? null)
      : null,
    row_label: unit.row_id ? (rowLabels.get(unit.row_id) ?? null) : null,
  }));

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
    location_name: item.location_id
      ? (locationNames.get(item.location_id) ?? null)
      : null,
    row_label: item.row_id ? (rowLabels.get(item.row_id) ?? null) : null,
  };
}
