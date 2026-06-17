"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/locations/types";

/**
 * Server actions for managing structured locations and warehouse rows. Every
 * action gates on requireModule("operations") (defense in depth alongside
 * RLS), validates with zod v4, mutates via the typed server client, revalidates
 * the inventory + locations pages, and returns an ActionState.
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

const locationKindEnum = z.enum(["warehouse", "offsite"]);

// --- Schemas ----------------------------------------------------------------

const CreateLocationSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  kind: locationKindEnum,
  notes: optionalText,
});

const UpdateLocationSchema = z.object({
  id: z.uuid("A location is required."),
  name: z.string().trim().min(1, "Name is required."),
  kind: locationKindEnum,
  notes: optionalText,
  is_active: z.boolean(),
});

const DeleteLocationSchema = z.object({
  id: z.uuid("A location is required."),
});

const AddWarehouseRowSchema = z.object({
  location_id: z.uuid("A location is required."),
  label: z.string().trim().min(1, "A row label is required."),
});

const RemoveWarehouseRowSchema = z.object({
  id: z.uuid("A row is required."),
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** Revalidate the inventory list + the locations manager page. */
function revalidateLocations(): void {
  revalidatePath("/operations/inventory");
  revalidatePath("/operations/inventory/locations");
}

// --- Actions ----------------------------------------------------------------

export async function createLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = CreateLocationSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("locations").insert({
    name: data.name,
    kind: data.kind,
    notes: data.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A location with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateLocations();
  return { success: true };
}

export async function updateLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = UpdateLocationSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    notes: formData.get("notes"),
    is_active: formData.get("is_active") != null,
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("locations")
    .update({
      name: data.name,
      kind: data.kind,
      notes: data.notes,
      is_active: data.is_active,
    })
    .eq("id", data.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A location with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateLocations();
  return { success: true };
}

export async function deleteLocation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = DeleteLocationSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidateLocations();
  return { success: true };
}

export async function addWarehouseRow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = AddWarehouseRowSchema.safeParse({
    location_id: formData.get("location_id"),
    label: formData.get("label"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("warehouse_rows").insert({
    location_id: data.location_id,
    label: data.label,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That row already exists." };
    }
    return { error: error.message };
  }

  revalidateLocations();
  return { success: true };
}

export async function removeWarehouseRow(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = RemoveWarehouseRowSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("warehouse_rows")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidateLocations();
  return { success: true };
}
