import type { Database } from "@/lib/database.types";

/**
 * Shared inventory types. These mirror the generated DB row shapes and add the
 * aggregated/joined view shapes used by the list and detail screens.
 */

export type InventoryCategory =
  Database["public"]["Tables"]["inventory_categories"]["Row"];
export type InventoryItem =
  Database["public"]["Tables"]["inventory_items"]["Row"];
export type InventoryUnit =
  Database["public"]["Tables"]["inventory_units"]["Row"];
export type MaintenanceRecord =
  Database["public"]["Tables"]["maintenance_records"]["Row"];

/** A row in the inventory list table: item + category + aggregates. */
export type InventoryListRow = InventoryItem & {
  category_name: string | null;
  unit_count: number;
  available_units: number;
  open_maintenance: number;
};

/** A single item with its category, its units, and its maintenance history. */
export type InventoryItemDetail = InventoryItem & {
  category_name: string | null;
  units: InventoryUnit[];
  maintenance: MaintenanceRecord[];
};

/** Return shape for every server action (useActionState compatible). */
export type ActionState = { error?: string; success?: boolean } | undefined;
