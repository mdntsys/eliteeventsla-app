"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireEdit } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/inventory/types";
import type { TablesInsert } from "@/lib/database.types";
import {
  optionalMoney,
  optionalText,
  optionalTimestamp,
  optionalUuid,
} from "@/lib/forms/coercions";

/**
 * Server actions for the inventory module. Every action gates on
 * requireEdit("inventory") (defense in depth alongside RLS), validates with
 * zod v4, mutates via the typed server client, revalidates affected paths, and
 * returns an ActionState (or redirects).
 */

const itemStatusEnum = z.enum(["available", "maintenance", "retired"]);
const unitStatusEnum = z.enum([
  "available",
  "reserved",
  "in_use",
  "maintenance",
  "retired",
]);
const maintenanceStatusEnum = z.enum(["open", "in_progress", "resolved"]);

// --- Schemas ----------------------------------------------------------------

const CreateItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  category_id: optionalUuid,
  kind: z.enum(["bulk", "serialized"]),
  quantity: z.coerce.number().int().min(0),
  daily_rate: optionalMoney,
  replacement_cost: optionalMoney,
  sku: optionalText,
  location: optionalText,
  location_id: optionalUuid,
  row_id: optionalUuid,
  section: optionalText,
  description: optionalText,
});

const AddUnitSchema = z.object({
  item_id: z.uuid("An item is required."),
  asset_tag: optionalText,
  serial_number: optionalText,
  status: unitStatusEnum.default("available"),
  condition_notes: optionalText,
  location_id: optionalUuid,
  row_id: optionalUuid,
  section: optionalText,
});

const SetItemLocationSchema = z.object({
  item_id: z.uuid("An item is required."),
  location_id: optionalUuid,
  row_id: optionalUuid,
  section: optionalText,
});

const SetUnitLocationSchema = z.object({
  unit_id: z.uuid("A unit is required."),
  item_id: z.uuid("An item is required."),
  location_id: optionalUuid,
  row_id: optionalUuid,
  section: optionalText,
});

const SetInventoryImageSchema = z.object({
  kind: z.enum(["item", "unit"]),
  target_id: z.uuid("A target is required."),
  item_id: z.uuid("An item is required."),
  url: z.string().trim().min(1, "An image URL is required."),
});

const UpdateItemStatusSchema = z.object({
  item_id: z.uuid("An item is required."),
  status: itemStatusEnum,
});

const LogMaintenanceSchema = z.object({
  item_id: z.uuid("An item is required."),
  unit_id: optionalUuid,
  issue: z.string().trim().min(1, "Describe the issue."),
  cost: optionalMoney,
  status: maintenanceStatusEnum.default("open"),
});

const ResolveMaintenanceSchema = z.object({
  id: z.uuid("A maintenance record is required."),
  item_id: z.uuid("An item is required."),
});

const ReserveForEventSchema = z.object({
  event_id: z.uuid("An event is required."),
  inventory_item_id: z.uuid("An item is required."),
  unit_id: optionalUuid,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  rate: optionalMoney,
  reserved_from: optionalTimestamp,
  reserved_to: optionalTimestamp,
});

const BulkAssignLocationSchema = z.object({
  item_ids: z.array(z.uuid()).min(1, "Select at least one item."),
  location_id: optionalUuid,
  row_id: optionalUuid,
});

const DeleteItemSchema = z.object({
  item_id: z.uuid("An item is required."),
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** The Postgres error code from a Supabase error, if present. */
function pgCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

// --- Actions ----------------------------------------------------------------

export async function createInventoryItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = CreateItemSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity"),
    daily_rate: formData.get("daily_rate"),
    replacement_cost: formData.get("replacement_cost"),
    sku: formData.get("sku"),
    location: formData.get("location"),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
    section: formData.get("section"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  // Serialized items are tracked by their unit rows; quantity stays 0.
  const quantity = data.kind === "serialized" ? 0 : data.quantity;

  const { data: inserted, error } = await supabase
    .from("inventory_items")
    .insert({
      name: data.name,
      category_id: data.category_id,
      kind: data.kind,
      quantity,
      daily_rate: data.daily_rate,
      replacement_cost: data.replacement_cost,
      sku: data.sku,
      location: data.location,
      location_id: data.location_id,
      row_id: data.row_id,
      section: data.section,
      description: data.description,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the item." };
  }

  revalidatePath("/operations/inventory");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/operations/inventory/${inserted.id}`);
}

export async function addInventoryUnit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = AddUnitSchema.safeParse({
    item_id: formData.get("item_id"),
    asset_tag: formData.get("asset_tag"),
    serial_number: formData.get("serial_number"),
    status: formData.get("status") ?? undefined,
    condition_notes: formData.get("condition_notes"),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
    section: formData.get("section"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("inventory_units").insert({
    item_id: data.item_id,
    asset_tag: data.asset_tag,
    serial_number: data.serial_number,
    status: data.status,
    condition_notes: data.condition_notes,
    location_id: data.location_id,
    row_id: data.row_id,
    section: data.section,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

export async function updateItemStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = UpdateItemStatusSchema.safeParse({
    item_id: formData.get("item_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({ status: data.status })
    .eq("id", data.item_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

export async function logMaintenance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = LogMaintenanceSchema.safeParse({
    item_id: formData.get("item_id"),
    unit_id: formData.get("unit_id"),
    issue: formData.get("issue"),
    cost: formData.get("cost"),
    status: formData.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase.from("maintenance_records").insert({
    item_id: data.item_id,
    unit_id: data.unit_id,
    issue: data.issue,
    cost: data.cost,
    status: data.status,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

export async function resolveMaintenance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = ResolveMaintenanceSchema.safeParse({
    id: formData.get("id"),
    item_id: formData.get("item_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("maintenance_records")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

// --- Locations on items / units ---------------------------------------------

export async function setItemLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = SetItemLocationSchema.safeParse({
    item_id: formData.get("item_id"),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
    section: formData.get("section"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({
      location_id: data.location_id,
      row_id: data.row_id,
      section: data.section,
    })
    .eq("id", data.item_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

export async function setUnitLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = SetUnitLocationSchema.safeParse({
    unit_id: formData.get("unit_id"),
    item_id: formData.get("item_id"),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
    section: formData.get("section"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("inventory_units")
    .update({
      location_id: data.location_id,
      row_id: data.row_id,
      section: data.section,
    })
    .eq("id", data.unit_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

export async function setInventoryImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = SetInventoryImageSchema.safeParse({
    kind: formData.get("kind"),
    target_id: formData.get("target_id"),
    item_id: formData.get("item_id"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } =
    data.kind === "item"
      ? await supabase
          .from("inventory_items")
          .update({ image_url: data.url })
          .eq("id", data.target_id)
      : await supabase
          .from("inventory_units")
          .update({ image_url: data.url })
          .eq("id", data.target_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/inventory/${data.item_id}`);
  revalidatePath("/operations/inventory");
  return { success: true };
}

// --- CSV import --------------------------------------------------------------

/** Result of a CSV import — ActionState-compatible with extra summary fields. */
export type ImportInventoryResult =
  | {
      error?: string;
      success?: boolean;
      created?: number;
      skipped?: number;
      /** Of `skipped`, how many were skipped because the SKU already exists. */
      skippedExisting?: number;
      errors?: string[];
    }
  | undefined;

/** Lower-case + trim a CSV header/value for case-insensitive matching. */
function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function importInventoryCsv(
  _prev: ImportInventoryResult,
  formData: FormData,
): Promise<ImportInventoryResult> {
  await requireEdit("inventory");

  const text = formData.get("csv");
  if (typeof text !== "string" || text.trim() === "") {
    return { error: "Paste or upload CSV content to import." };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data ?? [];
  if (rows.length === 0) {
    return { error: "No rows found in the CSV." };
  }

  const user = await getUser();
  const supabase = await createClient();

  // Reference data for resolving categories / locations / rows by name, plus
  // every SKU already on file so we can ADD new items only and skip any SKU that
  // already exists (existing inventory is left untouched).
  const [categoriesRes, locationsRes, rowsRes, existingRes] = await Promise.all([
    supabase.from("inventory_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("warehouse_rows").select("id, label, location_id"),
    supabase.from("inventory_items").select("sku"),
  ]);

  if (categoriesRes.error) return { error: categoriesRes.error.message };
  if (locationsRes.error) return { error: locationsRes.error.message };
  if (rowsRes.error) return { error: rowsRes.error.message };
  if (existingRes.error) return { error: existingRes.error.message };

  // SKUs already present (case-insensitive). We add to this set as we insert so
  // a SKU repeated within the same file is also skipped after its first row.
  const existingSkus = new Set<string>();
  for (const it of existingRes.data ?? []) {
    if (it.sku) existingSkus.add(normalizeKey(it.sku));
  }

  const categoryByName = new Map<string, string>();
  for (const c of categoriesRes.data ?? []) {
    categoryByName.set(normalizeKey(c.name), c.id);
  }
  const locationByName = new Map<string, string>();
  for (const l of locationsRes.data ?? []) {
    locationByName.set(normalizeKey(l.name), l.id);
  }
  // row label is unique per location: key by `${location_id}::${label}`.
  const rowByLocationLabel = new Map<string, string>();
  for (const r of rowsRes.data ?? []) {
    rowByLocationLabel.set(`${r.location_id}::${normalizeKey(r.label)}`, r.id);
  }

  let created = 0;
  let skipped = 0;
  let skippedExisting = 0;
  const errors: string[] = [];
  const toInsert: {
    record: TablesInsert<"inventory_items">;
    rowNum: number;
    name: string;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    // Normalize header keys to lower-case for case-insensitive column access.
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      row[normalizeKey(key)] = typeof value === "string" ? value : "";
    }

    const rowNum = i + 1;
    const get = (key: string): string => (row[key] ?? "").trim();

    const name = get("name");
    if (name === "") {
      skipped += 1;
      continue;
    }

    const kindRaw = normalizeKey(get("kind"));
    const kind = kindRaw === "serialized" ? "serialized" : "bulk";

    const categoryName = get("category");
    const categoryId =
      categoryName !== ""
        ? (categoryByName.get(normalizeKey(categoryName)) ?? null)
        : null;

    const locationName = get("location");
    const locationId =
      locationName !== ""
        ? (locationByName.get(normalizeKey(locationName)) ?? null)
        : null;

    const rowLabel = get("row");
    const rowId =
      rowLabel !== "" && locationId
        ? (rowByLocationLabel.get(
            `${locationId}::${normalizeKey(rowLabel)}`,
          ) ?? null)
        : null;

    const sku = get("sku") || null;
    // Add new SKUs only: if this SKU already exists (on file or earlier in this
    // same import), skip the row so existing inventory is never overwritten.
    if (sku && existingSkus.has(normalizeKey(sku))) {
      skipped += 1;
      skippedExisting += 1;
      continue;
    }

    const section = get("section") || null;
    const description = get("description") || null;

    // quantity (bulk only); default 0. Invalid -> 0.
    let quantity = 0;
    if (kind === "bulk") {
      const q = Number(get("quantity"));
      quantity = Number.isFinite(q) && q >= 0 ? Math.trunc(q) : 0;
    }

    const dailyRaw = get("daily_rate");
    const dailyRate =
      dailyRaw !== "" && Number.isFinite(Number(dailyRaw))
        ? Number(dailyRaw)
        : null;
    const replacementRaw = get("replacement_cost");
    const replacementCost =
      replacementRaw !== "" && Number.isFinite(Number(replacementRaw))
        ? Number(replacementRaw)
        : null;

    // Collect the row; insert in batches after the loop. Track the SKU now so a
    // later duplicate within this same file is still skipped.
    if (sku) existingSkus.add(normalizeKey(sku));
    toInsert.push({
      rowNum,
      name,
      record: {
        name,
        sku,
        kind,
        category_id: categoryId,
        quantity,
        daily_rate: dailyRate,
        replacement_cost: replacementCost,
        location_id: locationId,
        row_id: rowId,
        section,
        description,
        created_by: user?.id ?? null,
      },
    });
  }

  // Insert in chunks — one round-trip per chunk instead of one per row. If a
  // chunk fails, fall back to per-row inserts for that chunk so the failure is
  // attributed to a specific row and the rest of the chunk still lands.
  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("inventory_items")
      .insert(chunk.map((r) => r.record));
    if (!error) {
      created += chunk.length;
      continue;
    }
    for (const r of chunk) {
      const { error: rowErr } = await supabase
        .from("inventory_items")
        .insert(r.record);
      if (rowErr) errors.push(`Row ${r.rowNum} (${r.name}): ${rowErr.message}`);
      else created += 1;
    }
  }

  revalidatePath("/operations/inventory");
  return { success: true, created, skipped, skippedExisting, errors };
}

// --- Reserve for an event (from the inventory tab) --------------------------

/**
 * Reserve this inventory item for an event, straight from the inventory tab —
 * the reverse of the event hub's reserve form, writing the same `event_items`
 * row. Surfaces the double-booking EXCLUDE violation (23P01) as a friendly
 * message and revalidates both the inventory list and the target event.
 */
export async function reserveItemForEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = ReserveForEventSchema.safeParse({
    event_id: formData.get("event_id"),
    inventory_item_id: formData.get("inventory_item_id"),
    unit_id: formData.get("unit_id"),
    quantity: formData.get("quantity") ?? 1,
    rate: formData.get("rate"),
    reserved_from: formData.get("reserved_from"),
    reserved_to: formData.get("reserved_to"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  if (
    data.reserved_from &&
    data.reserved_to &&
    new Date(data.reserved_from).getTime() > new Date(data.reserved_to).getTime()
  ) {
    return { error: "The reserved window can't end before it starts." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("event_items").insert({
    event_id: data.event_id,
    inventory_item_id: data.inventory_item_id,
    unit_id: data.unit_id,
    quantity: data.quantity,
    rate: data.rate,
    reserved_from: data.reserved_from,
    reserved_to: data.reserved_to,
  });

  if (error) {
    if (pgCode(error) === "23P01") {
      return {
        error: "That unit is already booked for an overlapping window.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/operations/inventory");
  revalidatePath(`/operations/inventory/${data.inventory_item_id}`);
  revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}

// --- Bulk assign a storage location -----------------------------------------

/**
 * Set the storage location (and optional warehouse row) on a batch of items at
 * once — "assign all to Alvy Warehouse / Delia's". Updates each item's default
 * location AND its serialized units, so the list's location summary reflects the
 * move for bulk and serialized items alike. An empty location clears it.
 */
export async function bulkAssignLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = BulkAssignLocationSchema.safeParse({
    item_ids: formData.getAll("item_ids").map((v) => String(v)),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error: itemsError } = await supabase
    .from("inventory_items")
    .update({ location_id: data.location_id, row_id: data.row_id })
    .in("id", data.item_ids);
  if (itemsError) {
    return { error: itemsError.message };
  }

  const { error: unitsError } = await supabase
    .from("inventory_units")
    .update({ location_id: data.location_id, row_id: data.row_id })
    .in("item_id", data.item_ids);
  if (unitsError) {
    return { error: unitsError.message };
  }

  revalidatePath("/operations/inventory");
  return { success: true };
}

// --- Delete an inventory item (mistake cleanup) -----------------------------

/**
 * Hard-delete an inventory item that was entered by mistake. This is only safe
 * for items with NO event reservation history — deleting one that's been used on
 * jobs would erase that record, so those are protected and should be retired
 * (status='retired') instead. Serialized units and maintenance rows cascade.
 */
export async function deleteInventoryItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = DeleteItemSchema.safeParse({
    item_id: formData.get("item_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { item_id } = parsed.data;
  const supabase = await createClient();

  // An item that's ever been reserved on an event carries history worth keeping.
  const { count, error: countError } = await supabase
    .from("event_items")
    .select("id", { count: "exact", head: true })
    .eq("inventory_item_id", item_id);
  if (countError) {
    return { error: countError.message };
  }
  if ((count ?? 0) > 0) {
    return {
      error:
        "This item has been used on events, so it can't be deleted. Set its status to “Retired” instead to keep its history.",
    };
  }

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", item_id);
  if (error) {
    if (pgCode(error) === "23503") {
      return {
        error:
          "This item is still referenced elsewhere, so it can't be deleted. Retire it instead.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/operations/inventory");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect("/operations/inventory");
}
