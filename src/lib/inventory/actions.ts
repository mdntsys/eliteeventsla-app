"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireEdit } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/inventory/types";
import {
  optionalMoney,
  optionalText,
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

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
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

  // Reference data for resolving categories / locations / rows by name.
  const [categoriesRes, locationsRes, rowsRes] = await Promise.all([
    supabase.from("inventory_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("warehouse_rows").select("id, label, location_id"),
  ]);

  if (categoriesRes.error) return { error: categoriesRes.error.message };
  if (locationsRes.error) return { error: locationsRes.error.message };
  if (rowsRes.error) return { error: rowsRes.error.message };

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
  const errors: string[] = [];

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

    const { error } = await supabase.from("inventory_items").insert({
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
    });

    if (error) {
      errors.push(`Row ${rowNum} (${name}): ${error.message}`);
      continue;
    }

    created += 1;
  }

  revalidatePath("/operations/inventory");
  return { success: true, created, skipped, errors };
}
