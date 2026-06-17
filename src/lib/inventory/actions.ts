"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireModule } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/inventory/types";

/**
 * Server actions for the inventory module. Every action gates on
 * requireModule("operations") (defense in depth alongside RLS), validates with
 * zod v4, mutates via the typed server client, revalidates affected paths, and
 * returns an ActionState (or redirects).
 */

// --- Reusable field coercions -----------------------------------------------

/** Empty string -> null; otherwise trimmed string. */
const optionalText = z
  .string()
  .transform((v) => {
    const t = v.trim();
    return t === "" ? null : t;
  })
  .nullable();

/** Empty string -> null uuid; otherwise a validated uuid. */
const optionalUuid = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || z.uuid().safeParse(v).success, {
    message: "Invalid id.",
  })
  .transform((v) => (v === "" ? null : v));

/** Empty string -> null number; otherwise a coerced non-negative number. */
const optionalMoney = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Enter a valid amount." },
  )
  .transform((v) => (v === "" ? null : Number(v)));

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
  description: optionalText,
});

const AddUnitSchema = z.object({
  item_id: z.uuid("An item is required."),
  asset_tag: optionalText,
  serial_number: optionalText,
  status: unitStatusEnum.default("available"),
  condition_notes: optionalText,
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
  await requireModule("operations");

  const parsed = CreateItemSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity"),
    daily_rate: formData.get("daily_rate"),
    replacement_cost: formData.get("replacement_cost"),
    sku: formData.get("sku"),
    location: formData.get("location"),
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
  await requireModule("operations");

  const parsed = AddUnitSchema.safeParse({
    item_id: formData.get("item_id"),
    asset_tag: formData.get("asset_tag"),
    serial_number: formData.get("serial_number"),
    status: formData.get("status") ?? undefined,
    condition_notes: formData.get("condition_notes"),
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
  await requireModule("operations");

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
  await requireModule("operations");

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
  await requireModule("operations");

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
