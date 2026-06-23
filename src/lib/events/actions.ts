"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireEdit } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/events/types";
import {
  notifyBookingConfirmed,
  notifyCrewAssignment,
  notifyReturnReceipt,
} from "@/lib/email/send";

/**
 * Server actions for the event/job lifecycle. Every action gates with
 * requireEdit on its finer area: events for the job record (create/status/actual
 * times), inventory for event_items (reserve/checkout/return), scheduling for
 * schedule entries + crew assignment — matching the (forthcoming) RLS policy.
 * Validates with zod v4, mutates via the typed server client, revalidates
 * affected paths, and returns an ActionState (or redirects). Postgres
 * exclusion (23P01) and unique (23505) violations are surfaced as friendly
 * messages rather than raw errors.
 */

// --- Reusable field coercions -----------------------------------------------

const optionalText = z
  .string()
  .transform((v) => {
    const t = v.trim();
    return t === "" ? null : t;
  })
  .nullable();

const optionalUuid = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === "" || z.uuid().safeParse(v).success, {
    message: "Invalid id.",
  })
  .transform((v) => (v === "" ? null : v));

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

const optionalInt = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => {
      if (v === "") return true;
      const n = Number(v);
      return Number.isInteger(n) && n >= 0;
    },
    { message: "Enter a valid whole number." },
  )
  .transform((v) => (v === "" ? null : Number(v)));

/** Empty string -> null; otherwise a valid ISO/datetime-local timestamp. */
const optionalTimestamp = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
    { message: "Enter a valid date/time." },
  )
  .transform((v) => (v === "" ? null : new Date(v).toISOString()));

/** Empty string -> null; otherwise a date (YYYY-MM-DD passes through). */
const optionalDate = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
    { message: "Enter a valid date." },
  )
  .transform((v) => (v === "" ? null : v));

// --- Enums ------------------------------------------------------------------

const eventStatusEnum = z.enum([
  "draft",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);
const eventTypeEnum = z.enum(["corporate", "wedding", "personal", "other"]);
const scheduleTypeEnum = z.enum([
  "delivery",
  "pickup",
  "setup",
  "teardown",
  "site_visit",
  "other",
]);
const scheduleStatusEnum = z.enum([
  "scheduled",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
]);
const returnConditionEnum = z.enum(["good", "damaged", "lost"]);

// --- Schemas ----------------------------------------------------------------

const CreateEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  event_type: eventTypeEnum.default("other"),
  event_date: optionalDate,
  contact_id: optionalUuid,
  company_id: optionalUuid,
  venue_name: optionalText,
  guest_count: optionalInt,
});

const SetStatusSchema = z.object({
  event_id: z.uuid("An event is required."),
  status: eventStatusEnum,
});

const ReserveItemSchema = z
  .object({
    event_id: z.uuid("An event is required."),
    inventory_item_id: z.uuid("An item is required."),
    unit_id: optionalUuid,
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
    rate: optionalMoney,
    reserved_from: optionalTimestamp,
    reserved_to: optionalTimestamp,
  })
  .refine(
    (d) =>
      !d.reserved_from ||
      !d.reserved_to ||
      new Date(d.reserved_from).getTime() <=
        new Date(d.reserved_to).getTime(),
    {
      message: "The reserved window can't end before it starts.",
      path: ["reserved_to"],
    },
  );

const RemoveItemSchema = z.object({
  id: z.uuid("A line item is required."),
});

const AddScheduleSchema = z.object({
  event_id: z.uuid("An event is required."),
  type: scheduleTypeEnum,
  scheduled_start: optionalTimestamp,
  scheduled_end: optionalTimestamp,
  address: optionalText,
});

const UpdateScheduleStatusSchema = z.object({
  id: z.uuid("A schedule entry is required."),
  status: scheduleStatusEnum,
});

const AssignStaffSchema = z.object({
  schedule_entry_id: z.uuid("A schedule entry is required."),
  profile_id: z.uuid("A staff member is required."),
  role_on_job: optionalText,
});

const UnassignStaffSchema = z.object({
  id: z.uuid("An assignment is required."),
});

const CheckOutSchema = z.object({
  id: z.uuid("A line item is required."),
});

const CheckInSchema = z.object({
  id: z.uuid("A line item is required."),
  return_condition: returnConditionEnum,
  return_notes: optionalText,
});

const attachmentKindEnum = z.enum([
  "return_proof",
  "delivery_proof",
  "other",
]);

const UploadProofSchema = z.object({
  event_id: z.uuid("An event is required."),
  event_item_id: optionalUuid,
  kind: attachmentKindEnum.default("return_proof"),
});

const CheckOutAllSchema = z.object({
  event_id: z.uuid("An event is required."),
});

const SetActualTimesSchema = z.object({
  event_id: z.uuid("An event is required."),
  field: z.enum(["start", "end"]),
  value: z.string(),
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

/** Postgres error code from a Supabase/PostgREST error, if any. */
function pgCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

// --- Actions: the job record (events module) --------------------------------

export async function createEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("events");

  const parsed = CreateEventSchema.safeParse({
    title: formData.get("title"),
    event_type: formData.get("event_type") ?? undefined,
    event_date: formData.get("event_date"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    venue_name: formData.get("venue_name"),
    guest_count: formData.get("guest_count"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      title: data.title,
      event_type: data.event_type,
      event_date: data.event_date,
      contact_id: data.contact_id,
      company_id: data.company_id,
      venue_name: data.venue_name,
      guest_count: data.guest_count,
      created_by: user?.id ?? null,
      owner_id: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the event." };
  }

  revalidatePath("/events");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/events/${inserted.id}`);
}

export async function setEventStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("events");

  const parsed = SetStatusSchema.safeParse({
    event_id: formData.get("event_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({ status: data.status })
    .eq("id", data.event_id);

  if (error) {
    return { error: error.message };
  }

  // Fire-and-forget: email the client when their job is confirmed.
  if (data.status === "confirmed") {
    try {
      const { data: ev } = await supabase
        .from("events")
        .select("title, event_date, contact_id")
        .eq("id", data.event_id)
        .maybeSingle();
      if (ev?.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("email, first_name")
          .eq("id", ev.contact_id)
          .maybeSingle();
        await notifyBookingConfirmed(contact?.email, {
          eventTitle: ev?.title ?? "your event",
          eventDate: ev?.event_date ?? null,
          recipientName: contact?.first_name ?? null,
        });
      }
    } catch (e) {
      console.error("[email] booking-confirmed trigger failed:", e);
    }
  }

  revalidatePath(`/events/${data.event_id}`);
  revalidatePath("/events");
  return { success: true };
}

// --- Actions: logistics (operations module) ---------------------------------

export async function reserveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = ReserveItemSchema.safeParse({
    event_id: formData.get("event_id"),
    inventory_item_id: formData.get("inventory_item_id"),
    unit_id: formData.get("unit_id"),
    quantity: formData.get("quantity"),
    rate: formData.get("rate"),
    reserved_from: formData.get("reserved_from"),
    reserved_to: formData.get("reserved_to"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
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

  revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}

export async function removeEventItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = RemoveItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("event_items")
    .delete()
    .eq("id", parsed.data.id)
    .select("event_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (removed?.event_id) {
    revalidatePath(`/events/${removed.event_id}`);
  }
  return { success: true };
}

export async function addScheduleEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("scheduling");

  const parsed = AddScheduleSchema.safeParse({
    event_id: formData.get("event_id"),
    type: formData.get("type"),
    scheduled_start: formData.get("scheduled_start"),
    scheduled_end: formData.get("scheduled_end"),
    address: formData.get("address"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase.from("schedule_entries").insert({
    event_id: data.event_id,
    type: data.type,
    scheduled_start: data.scheduled_start,
    scheduled_end: data.scheduled_end,
    address: data.address,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${data.event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function updateScheduleStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("scheduling");

  const parsed = UpdateScheduleStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("schedule_entries")
    .update({ status: data.status })
    .eq("id", data.id)
    .select("event_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (updated?.event_id) {
    revalidatePath(`/events/${updated.event_id}`);
  }
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function assignStaff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("scheduling");

  const parsed = AssignStaffSchema.safeParse({
    schedule_entry_id: formData.get("schedule_entry_id"),
    profile_id: formData.get("profile_id"),
    role_on_job: formData.get("role_on_job"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("schedule_assignments").insert({
    schedule_entry_id: data.schedule_entry_id,
    profile_id: data.profile_id,
    role_on_job: data.role_on_job,
  });

  if (error) {
    if (pgCode(error) === "23505") {
      return { error: "Already assigned." };
    }
    return { error: error.message };
  }

  // Resolve the parent event to revalidate its hub page + notify the crew member.
  const { data: entry } = await supabase
    .from("schedule_entries")
    .select("event_id, scheduled_start")
    .eq("id", data.schedule_entry_id)
    .maybeSingle();
  if (entry?.event_id) {
    revalidatePath(`/events/${entry.event_id}`);
    try {
      const [{ data: prof }, { data: ev }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", data.profile_id)
          .maybeSingle(),
        supabase
          .from("events")
          .select("title")
          .eq("id", entry.event_id)
          .maybeSingle(),
      ]);
      await notifyCrewAssignment(prof?.email, {
        staffName: prof?.full_name ?? null,
        eventTitle: ev?.title ?? "a job",
        role: data.role_on_job ?? null,
        whenText: entry.scheduled_start ?? null,
      });
    } catch (e) {
      console.error("[email] crew-assignment trigger failed:", e);
    }
  }
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function unassignStaff(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("scheduling");

  const parsed = UnassignStaffSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("schedule_assignments")
    .delete()
    .eq("id", parsed.data.id)
    .select("schedule_entry_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (removed?.schedule_entry_id) {
    const { data: entry } = await supabase
      .from("schedule_entries")
      .select("event_id")
      .eq("id", removed.schedule_entry_id)
      .maybeSingle();
    if (entry?.event_id) {
      revalidatePath(`/events/${entry.event_id}`);
    }
  }
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function checkOutItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = CheckOutSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("event_items")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("event_id, unit_id")
    .maybeSingle();

  if (error || !updated) {
    return { error: error?.message ?? "Could not check out the item." };
  }

  if (updated.unit_id) {
    const { error: unitError } = await supabase
      .from("inventory_units")
      .update({ status: "in_use" })
      .eq("id", updated.unit_id);
    if (unitError) {
      return { error: unitError.message };
    }
  }

  // Auto-advance a confirmed job to in_progress on first check-out.
  if (updated.event_id) {
    const { data: parent } = await supabase
      .from("events")
      .select("status")
      .eq("id", updated.event_id)
      .maybeSingle();
    if (parent?.status === "confirmed") {
      await supabase
        .from("events")
        .update({ status: "in_progress" })
        .eq("id", updated.event_id);
    }
  }

  revalidatePath(`/events/${updated.event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function checkInItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = CheckInSchema.safeParse({
    id: formData.get("id"),
    return_condition: formData.get("return_condition"),
    return_notes: formData.get("return_notes"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("event_items")
    .update({
      returned_at: new Date().toISOString(),
      return_condition: data.return_condition,
      return_notes: data.return_notes,
    })
    .eq("id", data.id)
    .select("event_id, unit_id")
    .maybeSingle();

  if (error || !updated) {
    return { error: error?.message ?? "Could not check in the item." };
  }

  if (updated.unit_id) {
    const unitStatus =
      data.return_condition === "good"
        ? "available"
        : data.return_condition === "damaged"
          ? "maintenance"
          : "retired";
    const { error: unitError } = await supabase
      .from("inventory_units")
      .update({ status: unitStatus })
      .eq("id", updated.unit_id);
    if (unitError) {
      return { error: unitError.message };
    }
  }

  // Auto-complete the job once every reserved item has been returned.
  if (updated.event_id) {
    const { count: outstanding } = await supabase
      .from("event_items")
      .select("id", { count: "exact", head: true })
      .eq("event_id", updated.event_id)
      .is("returned_at", null);
    const { count: total } = await supabase
      .from("event_items")
      .select("id", { count: "exact", head: true })
      .eq("event_id", updated.event_id);
    if ((outstanding ?? 0) === 0 && (total ?? 0) >= 1) {
      await supabase
        .from("events")
        .update({ status: "completed" })
        .eq("id", updated.event_id);
      // All items back → email the client a return receipt.
      try {
        const { data: ev } = await supabase
          .from("events")
          .select("title, contact_id")
          .eq("id", updated.event_id)
          .maybeSingle();
        if (ev?.contact_id) {
          const { data: contact } = await supabase
            .from("contacts")
            .select("email, first_name")
            .eq("id", ev.contact_id)
            .maybeSingle();
          await notifyReturnReceipt(contact?.email, {
            eventTitle: ev?.title ?? "your event",
            recipientName: contact?.first_name ?? null,
          });
        }
      } catch (e) {
        console.error("[email] return-receipt trigger failed:", e);
      }
    }
  }

  revalidatePath(`/events/${updated.event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}

export async function uploadReturnProof(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = UploadProofSchema.safeParse({
    event_id: formData.get("event_id"),
    event_item_id: formData.get("event_item_id"),
    kind: formData.get("kind") ?? undefined,
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo to upload." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Only image files are allowed." };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${data.event_id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("operations-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase
    .from("event_attachments")
    .insert({
      event_id: data.event_id,
      event_item_id: data.event_item_id,
      storage_path: path,
      kind: data.kind,
      uploaded_by: user?.id ?? null,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/events/${data.event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}

// --- Actions: load-out + actual event times ---------------------------------

/**
 * Bulk check-out: stamp checked_out_at on every still-open, not-yet-returned
 * line of an event, flip their serialized units to in_use, and bump a
 * confirmed job to in_progress.
 */
export async function checkOutAllItems(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("inventory");

  const parsed = CheckOutAllSchema.safeParse({
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { event_id } = parsed.data;
  const supabase = await createClient();

  const { data: pending, error: pendingError } = await supabase
    .from("event_items")
    .select("id, unit_id")
    .eq("event_id", event_id)
    .is("checked_out_at", null)
    .is("returned_at", null);

  if (pendingError) {
    return { error: pendingError.message };
  }

  const rows = pending ?? [];
  if (rows.length === 0) {
    return { error: "Nothing left to check out." };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("event_items")
    .update({ checked_out_at: now })
    .eq("event_id", event_id)
    .is("checked_out_at", null)
    .is("returned_at", null);

  if (updateError) {
    return { error: updateError.message };
  }

  const unitIds = rows
    .map((r) => r.unit_id)
    .filter((id): id is string => id !== null);
  if (unitIds.length > 0) {
    const { error: unitError } = await supabase
      .from("inventory_units")
      .update({ status: "in_use" })
      .in("id", unitIds);
    if (unitError) {
      return { error: unitError.message };
    }
  }

  const { data: parent } = await supabase
    .from("events")
    .select("status")
    .eq("id", event_id)
    .maybeSingle();
  if (parent?.status === "confirmed") {
    await supabase
      .from("events")
      .update({ status: "in_progress" })
      .eq("id", event_id);
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}

/**
 * Record an actual event start/end time. value: 'now' stamps the current time,
 * '' clears it, otherwise an ISO/datetime-local string is parsed and stored.
 */
export async function setActualEventTimes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("events");

  const parsed = SetActualTimesSchema.safeParse({
    event_id: formData.get("event_id"),
    field: formData.get("field"),
    value: formData.get("value"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const { event_id, field, value } = parsed.data;

  let ts: string | null;
  const trimmed = value.trim();
  if (trimmed === "now") {
    ts = new Date().toISOString();
  } else if (trimmed === "") {
    ts = null;
  } else {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      return { error: "Enter a valid date/time." };
    }
    ts = d.toISOString();
  }

  const supabase = await createClient();

  const patch =
    field === "start" ? { actual_start_at: ts } : { actual_end_at: ts };
  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", event_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/events/${event_id}`);
  revalidatePath("/operations/scheduling");
  return { success: true };
}
