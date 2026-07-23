"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireEdit } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/inventory/types";
import type { TablesUpdate } from "@/lib/database.types";
import { optionalInt, optionalText, optionalUuid } from "@/lib/forms/coercions";

/**
 * Server actions for inventory bundles ("kits") — the pallets a crew member
 * pulls as one. Same contract as the rest of the module: gate on
 * requireEdit("inventory"), validate with zod v4, mutate via the typed server
 * client, revalidate, return an ActionState.
 *
 * See @/lib/inventory/kits for the read side and the data model.
 */

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** The Postgres error code from a Supabase error, if present. */
function pgCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function revalidateKits(kitId?: string) {
  revalidatePath("/operations/inventory/kits");
  if (kitId) revalidatePath(`/operations/inventory/kits/${kitId}`);
  revalidatePath("/operations/inventory");
}

const kitFields = {
  name: z.string().trim().min(1, "A bundle name is required."),
  description: optionalText,
  location_id: optionalUuid,
  row_id: optionalUuid,
  section: optionalText,
};

const CreateKitSchema = z.object(kitFields);
const UpdateKitSchema = z.object({
  id: z.uuid("A bundle is required."),
  ...kitFields,
  is_active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
const KitIdSchema = z.object({ id: z.uuid("A bundle is required.") });

function kitFieldsFrom(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    location_id: formData.get("location_id"),
    row_id: formData.get("row_id"),
    section: formData.get("section"),
  };
}

/** Create an empty bundle, then open it so items can be added. */
export async function createKit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = CreateKitSchema.safeParse(kitFieldsFrom(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const user = await getUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_kits")
    .insert({ ...parsed.data, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (error) {
    if (pgCode(error) === "23505") {
      return { error: "A bundle with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateKits();
  redirect(`/operations/inventory/kits/${data.id}`);
}

/** Rename / relocate / retire a bundle. */
export async function updateKit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = UpdateKitSchema.safeParse({
    id: formData.get("id"),
    ...kitFieldsFrom(formData),
    is_active: formData.get("is_active") ?? "false",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { id, ...data } = parsed.data;
  const supabase = await createClient();

  const update: TablesUpdate<"inventory_kits"> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("inventory_kits")
    .update(update)
    .eq("id", id);

  if (error) {
    if (pgCode(error) === "23505") {
      return { error: "A bundle with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateKits(id);
  return { success: true };
}

/**
 * Delete a bundle. Its lines cascade, but nothing about the INVENTORY changes —
 * a bundle is only a grouping, so removing it never touches item quantities or
 * any reservation already made from it.
 */
export async function deleteKit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = KitIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_kits")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidateKits();
  redirect("/operations/inventory/kits");
}

const AddLineSchema = z.object({
  kit_id: z.uuid("A bundle is required."),
  item_id: z.uuid("Pick an item."),
  unit_id: optionalUuid,
  quantity: optionalInt,
});

/**
 * Add an item to a bundle. A serialized asset can be pinned by unit (that
 * pallet's own booth machine); otherwise it's a quantity of a bulk item, which
 * is how the same 20-count box splits 10/10 across two bundles.
 */
export async function addKitLine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = AddLineSchema.safeParse({
    kit_id: formData.get("kit_id"),
    item_id: formData.get("item_id"),
    unit_id: formData.get("unit_id"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { kit_id, item_id, unit_id } = parsed.data;
  // A pinned unit is exactly one thing; the CHECK constraint enforces this too.
  const quantity = unit_id ? 1 : Math.max(1, parsed.data.quantity ?? 1);

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_kit_items")
    .insert({ kit_id, item_id, unit_id, quantity });

  if (error) {
    if (pgCode(error) === "23505") {
      return {
        error: unit_id
          ? "That unit is already assigned to a bundle."
          : "That item is already in this bundle — edit its quantity instead.",
      };
    }
    return { error: error.message };
  }

  revalidateKits(kit_id);
  return { success: true };
}

const UpdateLineSchema = z.object({
  id: z.uuid("A bundle line is required."),
  kit_id: z.uuid("A bundle is required."),
  quantity: optionalInt,
});

/** Change how many of an item the bundle carries. */
export async function updateKitLine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = UpdateLineSchema.safeParse({
    id: formData.get("id"),
    kit_id: formData.get("kit_id"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const quantity = Math.max(1, parsed.data.quantity ?? 1);
  const supabase = await createClient();

  const { error } = await supabase
    .from("inventory_kit_items")
    .update({ quantity })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidateKits(parsed.data.kit_id);
  return { success: true };
}

const RemoveLineSchema = z.object({
  id: z.uuid("A bundle line is required."),
  kit_id: z.uuid("A bundle is required."),
});

/** Take an item back out of a bundle. */
export async function removeKitLine(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = RemoveLineSchema.safeParse({
    id: formData.get("id"),
    kit_id: formData.get("kit_id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_kit_items")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidateKits(parsed.data.kit_id);
  return { success: true };
}

const AssignToKitSchema = z.object({
  kit_id: z.uuid("Pick a bundle."),
  item_ids: z.array(z.uuid()).min(1, "Select at least one item."),
  quantity: optionalInt,
});

/**
 * Bulk-add selected inventory items to a bundle, from the inventory list —
 * the fast way to fill a fresh pallet. Items already in the bundle are skipped
 * rather than erroring, so re-running a selection is safe.
 */
export async function assignItemsToKit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = AssignToKitSchema.safeParse({
    kit_id: formData.get("kit_id"),
    item_ids: formData.getAll("item_ids").map(String),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { kit_id, item_ids } = parsed.data;
  const quantity = Math.max(1, parsed.data.quantity ?? 1);
  const supabase = await createClient();

  // Skip what's already in the bundle so a repeated selection is a no-op
  // instead of tripping the one-line-per-item unique index.
  const { data: existing, error: readError } = await supabase
    .from("inventory_kit_items")
    .select("item_id")
    .eq("kit_id", kit_id)
    .is("unit_id", null);
  if (readError) return { error: readError.message };

  const already = new Set((existing ?? []).map((r) => r.item_id));
  const toAdd = item_ids.filter((id) => !already.has(id));

  if (toAdd.length === 0) {
    return { success: true, warning: "Those items are already in that bundle." };
  }

  const { error } = await supabase
    .from("inventory_kit_items")
    .insert(toAdd.map((item_id) => ({ kit_id, item_id, quantity })));

  if (error) return { error: error.message };

  revalidateKits(kit_id);
  const skipped = item_ids.length - toAdd.length;
  return {
    success: true,
    warning:
      skipped > 0
        ? `Added ${toAdd.length}. ${skipped} already in the bundle.`
        : undefined,
  };
}
