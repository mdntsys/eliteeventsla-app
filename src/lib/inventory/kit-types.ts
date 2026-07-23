import type { Tables } from "@/lib/database.types";

/**
 * Shared shapes for inventory bundles ("kits"), plus the one pure helper that
 * formats a bundle's location.
 *
 * Deliberately NOT server-only: the bundle screens are client components, so
 * these have to be importable from the browser. The reads live in
 * @/lib/inventory/kits (server-only) and the writes in kit-actions.
 */

export type InventoryKit = Tables<"inventory_kits">;

/** One line of a bundle, joined to the item (and unit) it points at. */
export type KitLine = {
  id: string;
  item_id: string;
  unit_id: string | null;
  quantity: number;
  notes: string | null;
  item_name: string;
  item_sku: string | null;
  item_kind: "bulk" | "serialized";
  /** On-hand count for a bulk item; unit count for a serialized one. */
  item_on_hand: number;
  unit_asset_tag: string | null;
};

/** A bundle in the list view: where it lives + how much is in it. */
export type KitListRow = InventoryKit & {
  location_name: string | null;
  row_label: string | null;
  line_count: number;
  /** Total physical pieces across all lines (quantities summed). */
  piece_count: number;
};

/** A bundle with its full contents, for the detail page. */
export type KitDetail = KitListRow & {
  lines: KitLine[];
};

/** A bundle offered in a picker (event hub, bulk-assign bar). */
export type KitOption = {
  id: string;
  name: string;
  line_count: number;
  location_label: string | null;
};

/** Where a bundle physically lives, as one readable string. */
export function kitLocationLabel(kit: {
  location_name: string | null;
  row_label: string | null;
  section: string | null;
}): string | null {
  const parts = [
    kit.location_name,
    kit.row_label ? `Row ${kit.row_label}` : null,
    kit.section,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
