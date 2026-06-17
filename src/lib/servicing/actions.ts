"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireModule } from "@/lib/auth/dal";
import type { ActionState } from "@/lib/servicing/types";

/**
 * Server actions for the servicing module (client service tickets + comment
 * threads). Every action gates with requireModule("operations") — matching the
 * RLS write policy — validates with zod v4, mutates via the typed server
 * client, revalidates affected paths, and returns an ActionState (or
 * redirects).
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

// --- Enums ------------------------------------------------------------------

const categoryEnum = z.enum([
  "delivery",
  "equipment",
  "billing",
  "change_request",
  "complaint",
  "general",
]);
const priorityEnum = z.enum(["low", "medium", "high", "urgent"]);
const statusEnum = z.enum(["open", "in_progress", "resolved", "closed"]);

// --- Schemas ----------------------------------------------------------------

const CreateTicketSchema = z.object({
  subject: z.string().trim().min(1, "A subject is required."),
  description: optionalText,
  category: categoryEnum.default("general"),
  priority: priorityEnum.default("medium"),
  status: statusEnum.default("open"),
  event_id: optionalUuid,
  contact_id: optionalUuid,
  assigned_to: optionalUuid,
});

const UpdateTicketSchema = z.object({
  id: z.uuid("A ticket is required."),
  status: statusEnum,
  priority: priorityEnum,
  category: categoryEnum,
  assigned_to: optionalUuid,
  event_id: optionalUuid,
});

const AddCommentSchema = z.object({
  ticket_id: z.uuid("A ticket is required."),
  body: z.string().trim().min(1, "Write a note before saving."),
  event_id: optionalUuid,
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

// --- Actions ----------------------------------------------------------------

export async function createTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = CreateTicketSchema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category") ?? undefined,
    priority: formData.get("priority") ?? undefined,
    status: formData.get("status") ?? undefined,
    event_id: formData.get("event_id"),
    contact_id: formData.get("contact_id"),
    assigned_to: formData.get("assigned_to"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const resolved =
    data.status === "resolved" || data.status === "closed"
      ? new Date().toISOString()
      : null;

  const { data: inserted, error } = await supabase
    .from("service_tickets")
    .insert({
      subject: data.subject,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.status,
      event_id: data.event_id,
      contact_id: data.contact_id,
      assigned_to: data.assigned_to,
      resolved_at: resolved,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the ticket." };
  }

  revalidatePath("/operations/servicing");
  if (data.event_id) revalidatePath(`/events/${data.event_id}`);
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/operations/servicing/${inserted.id}`);
}

export async function updateTicket(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = UpdateTicketSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    category: formData.get("category"),
    assigned_to: formData.get("assigned_to"),
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const resolved =
    data.status === "resolved" || data.status === "closed"
      ? new Date().toISOString()
      : null;

  const { error } = await supabase
    .from("service_tickets")
    .update({
      status: data.status,
      priority: data.priority,
      category: data.category,
      assigned_to: data.assigned_to,
      resolved_at: resolved,
    })
    .eq("id", data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/servicing/${data.id}`);
  revalidatePath("/operations/servicing");
  if (data.event_id) revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}

export async function addTicketComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireModule("operations");

  const parsed = AddCommentSchema.safeParse({
    ticket_id: formData.get("ticket_id"),
    body: formData.get("body"),
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) {
    return { error: firstError(parsed.error) };
  }

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: data.ticket_id,
    body: data.body,
    author_id: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/operations/servicing/${data.ticket_id}`);
  if (data.event_id) revalidatePath(`/events/${data.event_id}`);
  return { success: true };
}
