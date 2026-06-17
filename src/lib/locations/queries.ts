import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Location,
  LocationOption,
  LocationWithRows,
  WarehouseRow,
} from "@/lib/locations/types";

/** All locations, ordered by name. */
export async function listLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every location with its warehouse rows attached (locations ordered by name,
 * rows ordered by label). Offsite locations simply carry an empty rows array.
 */
export async function listLocationsWithRows(): Promise<LocationWithRows[]> {
  const supabase = await createClient();

  const [locationsRes, rowsRes] = await Promise.all([
    supabase.from("locations").select("*").order("name", { ascending: true }),
    supabase
      .from("warehouse_rows")
      .select("*")
      .order("label", { ascending: true }),
  ]);

  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);

  const locations = locationsRes.data ?? [];
  const rows = (rowsRes.data ?? []) as WarehouseRow[];

  const rowsByLocation = new Map<string, WarehouseRow[]>();
  for (const row of rows) {
    const list = rowsByLocation.get(row.location_id) ?? [];
    list.push(row);
    rowsByLocation.set(row.location_id, list);
  }

  return locations.map((location) => ({
    ...location,
    rows: rowsByLocation.get(location.id) ?? [],
  }));
}

/**
 * Locations as compact dropdown options ({id, name, kind, rows:[{id,label}]}).
 * This is the source for the item/unit location pickers.
 */
export async function listLocationOptions(): Promise<LocationOption[]> {
  const locations = await listLocationsWithRows();
  return locations.map((location) => ({
    id: location.id,
    name: location.name,
    kind: location.kind,
    rows: location.rows.map((row) => ({ id: row.id, label: row.label })),
  }));
}
