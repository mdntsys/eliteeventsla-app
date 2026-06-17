import type { Database } from "@/lib/database.types";

/**
 * Shared types for the structured-locations feature: physical locations
 * (warehouses / offsite) and the rows within a warehouse, plus the joined and
 * dropdown-friendly view shapes used by the location pickers.
 */

export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type WarehouseRow =
  Database["public"]["Tables"]["warehouse_rows"]["Row"];

/** A location with its warehouse rows (rows ordered by label). */
export type LocationWithRows = Location & { rows: WarehouseRow[] };

/** Compact option shape for item/unit location dropdowns. */
export type LocationOption = {
  id: string;
  name: string;
  kind: "warehouse" | "offsite";
  rows: { id: string; label: string }[];
};

/** Return shape for every location server action (useActionState compatible). */
export type ActionState = { error?: string; success?: boolean } | undefined;
