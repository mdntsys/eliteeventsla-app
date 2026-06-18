"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireModule } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/vendors/types";
import { notifyVendorConfirmationRequest } from "@/lib/email/send";

/**
 * Server actions for the vendors module. Every action gates on
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

/** Empty string -> null; otherwise a trimmed, validated email. */
const optionalEmail = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || z.email().safeParse(v).success, {
    message: "Enter a valid email.",
  })
  .transform((v) => (v === "" ? null : v));

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

/** Empty string -> null; otherwise a number in [0, 5]. */
const optionalRating = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 5;
    },
    { message: "Rating must be between 0 and 5." },
  )
  .transform((v) => (v === "" ? null : Number(v)));

/** HTML checkbox -> boolean ("on"/"true" => true). */
const checkbox = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const vendorStatusEnum = z.enum(["active", "inactive"]);
const eventVendorStatusEnum = z.enum(["proposed", "confirmed", "declined"]);

// --- Schemas ----------------------------------------------------------------

const vendorFields = {
  name: z.string().trim().min(1, "Name is required."),
  category_id: optionalUuid,
  contact_name: optionalText,
  email: optionalEmail,
  phone: optionalText,
  website: optionalText,
  address: optionalText,
  rating: optionalRating,
  preferred: checkbox,
  status: vendorStatusEnum.default("active"),
  notes: optionalText,
};

const CreateVendorSchema = z.object(vendorFields);

const UpdateVendorSchema = z.object({
  id: z.uuid("A vendor is required."),
  ...vendorFields,
});

const AddEventVendorSchema = z.object({
  event_id: z.uuid("An event is required."),
  vendor_id: z.uuid("A vendor is required."),
  service: optionalText,
  agreed_cost: optionalMoney,
  status: eventVendorStatusEnum.default("proposed"),
  notes: optionalText,
});

const UpdateEventVendorStatusSchema = z.object({
  id: z.uuid("An event vendor is required."),
  status: eventVendorStatusEnum,
  event_id: z.uuid("An event is required."),
});

const RemoveEventVendorSchema = z.object({
  id: z.uuid("An event vendor is required."),
  event_id: z.uuid("An event is required."),
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

// --- Actions ----------------------------------------------------------------

export async function createVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = CreateVendorSchema.safeParse({
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    address: formData.get("address"),
    rating: formData.get("rating"),
    preferred: formData.get("preferred"),
    status: formData.get("status") ?? undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("vendors")
    .insert({
      name: data.name,
      category_id: data.category_id,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      address: data.address,
      rating: data.rating,
      preferred: data.preferred,
      status: data.status,
      notes: data.notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the vendor." };
  }

  revalidatePath("/operations/vendors");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/operations/vendors/${inserted.id}`);
}

export async function updateVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = UpdateVendorSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    category_id: formData.get("category_id"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    address: formData.get("address"),
    rating: formData.get("rating"),
    preferred: formData.get("preferred"),
    status: formData.get("status") ?? undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { id, ...data } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("vendors")
    .update({
      name: data.name,
      category_id: data.category_id,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone,
      website: data.website,
      address: data.address,
      rating: data.rating,
      preferred: data.preferred,
      status: data.status,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/vendors/${id}`);
  revalidatePath("/operations/vendors");
  return { success: true };
}

export async function addEventVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = AddEventVendorSchema.safeParse({
    event_id: formData.get("event_id"),
    vendor_id: formData.get("vendor_id"),
    service: formData.get("service"),
    agreed_cost: formData.get("agreed_cost"),
    status: formData.get("status") ?? undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("event_vendors").insert({
    event_id: data.event_id,
    vendor_id: data.vendor_id,
    service: data.service,
    agreed_cost: data.agreed_cost,
    status: data.status,
    notes: data.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That vendor is already on this event." };
    }
    return { error: error.message };
  }

  // Fire-and-forget: ask the vendor to confirm the booking.
  try {
    const [{ data: vendor }, { data: ev }] = await Promise.all([
      supabase
        .from("vendors")
        .select("name, email")
        .eq("id", data.vendor_id)
        .maybeSingle(),
      supabase
        .from("events")
        .select("title, event_date")
        .eq("id", data.event_id)
        .maybeSingle(),
    ]);
    await notifyVendorConfirmationRequest(vendor?.email, {
      vendorName: vendor?.name ?? "there",
      eventTitle: ev?.title ?? "an upcoming event",
      service: data.service ?? null,
      eventDate: ev?.event_date ?? null,
    });
  } catch (e) {
    console.error("[email] vendor-confirmation trigger failed:", e);
  }

  revalidatePath(`/events/${data.event_id}`);
  revalidatePath(`/operations/vendors/${data.vendor_id}`);
  return { success: true };
}

export async function updateEventVendorStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = UpdateEventVendorStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_vendors")
    .update({ status: data.status })
    .eq("id", data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}

export async function removeEventVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = RemoveEventVendorSchema.safeParse({
    id: formData.get("id"),
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("event_vendors")
    .delete()
    .eq("id", data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}
