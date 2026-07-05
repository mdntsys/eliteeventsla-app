"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/database.types";
import { getUser, getProfile, requireEdit } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import {
  optionalDate,
  optionalDateTime,
  optionalEmail,
  optionalMoney,
  optionalText,
  optionalUuid,
} from "@/lib/forms/coercions";
import type { ActionState, Option } from "@/lib/crm/types";

/**
 * Server actions for the CRM module (contacts, companies, deals, pipeline,
 * activities). Every action gates with requireEdit("crm") — matching the RLS
 * write policy — validates with zod v4, mutates via the typed server client,
 * revalidates affected paths, and returns an ActionState (or redirects).
 */

// Field coercions (optionalText / optionalUuid / optionalMoney / …) are shared
// across modules — see @/lib/forms/coercions. They normalize an absent field
// (FormData.get → null) to empty, so omitting an optional input never crashes.

// --- Enums ------------------------------------------------------------------

const eventTypeEnum = z.enum(["corporate", "wedding", "personal", "other"]);
const activityTypeEnum = z.enum(["call", "email", "meeting", "note", "task"]);

// --- Schemas ----------------------------------------------------------------

const contactFields = {
  first_name: z.string().trim().min(1, "A first name is required."),
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalText,
  title: optionalText,
  company_id: optionalUuid,
  source: optionalText,
  owner_id: optionalUuid,
  notes: optionalText,
};

const CreateContactSchema = z.object(contactFields);
const UpdateContactSchema = z.object({
  id: z.uuid("A contact is required."),
  ...contactFields,
});

const companyFields = {
  name: z.string().trim().min(1, "A name is required."),
  industry: optionalText,
  website: optionalText,
  phone: optionalText,
  email: optionalEmail,
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  state: optionalText,
  postal_code: optionalText,
  country: optionalText,
  // Ownership lives on contacts, not companies (individual clients have no
  // company; deals carry their own sales owner). No owner_id here by design.
  notes: optionalText,
};

const CreateCompanySchema = z.object(companyFields);
const UpdateCompanySchema = z.object({
  id: z.uuid("A company is required."),
  ...companyFields,
});

const dealFields = {
  title: z.string().trim().min(1, "A title is required."),
  contact_id: optionalUuid,
  company_id: optionalUuid,
  stage_id: optionalUuid,
  estimated_value: optionalMoney,
  expected_event_date: optionalDate,
  follow_up_date: optionalDate,
  event_type: z
    .union([z.literal(""), eventTypeEnum])
    .transform((v) => (v === "" ? null : v)),
  source: optionalText,
  owner_id: optionalUuid,
  notes: optionalText,
};

const CreateDealSchema = z.object(dealFields);
const UpdateDealSchema = z.object({
  id: z.uuid("A deal is required."),
  ...dealFields,
});

const SetDealStageSchema = z.object({
  deal_id: z.uuid("A deal is required."),
  stage_id: z.uuid("A stage is required."),
});

const ConvertDealSchema = z.object({
  deal_id: z.uuid("A deal is required."),
});

const LogActivitySchema = z
  .object({
    type: activityTypeEnum.default("note"),
    subject: optionalText,
    body: optionalText,
    due_at: optionalDateTime,
    assigned_to: optionalUuid,
    contact_id: optionalUuid,
    company_id: optionalUuid,
    deal_id: optionalUuid,
    event_id: optionalUuid,
  })
  .refine(
    (d) =>
      Boolean(d.contact_id || d.company_id || d.deal_id || d.event_id),
    { message: "Link the activity to a contact, company, deal, or event." },
  );

const CompleteActivitySchema = z.object({
  id: z.uuid("An activity is required."),
});

const DeleteActivitySchema = z.object({
  id: z.uuid("An activity is required."),
});

/** Pull the first zod issue message for a friendly action error. */
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

// --- Contacts ---------------------------------------------------------------

export async function createContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = CreateContactSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    company_id: formData.get("company_id"),
    source: formData.get("source"),
    owner_id: formData.get("owner_id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("contacts")
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      title: data.title,
      company_id: data.company_id,
      source: data.source,
      owner_id: data.owner_id,
      notes: data.notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the contact." };
  }

  revalidatePath("/crm/contacts");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/crm/contacts/${inserted.id}`);
}

export async function updateContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = UpdateContactSchema.safeParse({
    id: formData.get("id"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    company_id: formData.get("company_id"),
    source: formData.get("source"),
    owner_id: formData.get("owner_id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { id, ...data } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      title: data.title,
      company_id: data.company_id,
      source: data.source,
      owner_id: data.owner_id,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/crm/contacts/${id}`);
  revalidatePath("/crm/contacts");
  return { success: true };
}

/** Result of an inline contact create: the new option on success, else an error. */
export type CreateContactInlineResult =
  | { ok: true; contact: Option }
  | { ok: false; error: string };

const CreateContactInlineSchema = z.object({
  first_name: z.string().trim().min(1, "A first name is required."),
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalText,
  company_id: optionalUuid,
});

/**
 * Create a contact and return it as a form Option — without redirecting. Powers
 * the "add a contact without leaving the page" affordance in the New Deal modal
 * (and any contact picker that wants inline creation). Mirrors createContact's
 * RLS gate + insert, but stays put and hands the caller the new id/label so it
 * can be selected immediately. Called with a plain object (not FormData) so it
 * needs no nested <form>.
 */
export async function createContactInline(
  input: unknown,
): Promise<CreateContactInlineResult> {
  // This runs from inside another module's form modal (invoice, quote, event,
  // ticket), so a permission failure must return a clean inline error rather
  // than redirect the whole page out of the modal (what requireEdit does).
  // Gate on crm-edit — the same right the contacts-table RLS enforces on insert.
  const profile = await getProfile();
  if (!profile || !profile.is_active || !canEdit(profile, "crm")) {
    return {
      ok: false,
      error: "You don't have permission to add a contact.",
    };
  }

  const parsed = CreateContactInlineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("contacts")
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      company_id: data.company_id,
      created_by: user?.id ?? null,
    })
    .select("id, first_name, last_name")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      error: error?.message ?? "Could not create the contact.",
    };
  }

  // Surface the new contact wherever contacts are listed/selected.
  revalidatePath("/crm/contacts");
  revalidatePath("/crm");
  revalidatePath("/crm/deals");

  const label =
    [inserted.first_name, inserted.last_name]
      .filter((p) => p && p.trim() !== "")
      .join(" ")
      .trim() || "Unnamed contact";

  return { ok: true, contact: { id: inserted.id, label } };
}

// --- Companies --------------------------------------------------------------

export async function createCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = CreateCompanySchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry"),
    website: formData.get("website"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postal_code: formData.get("postal_code"),
    country: formData.get("country"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({
      name: data.name,
      industry: data.industry,
      website: data.website,
      phone: data.phone,
      email: data.email,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      country: data.country,
      notes: data.notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the company." };
  }

  revalidatePath("/crm/companies");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/crm/companies/${inserted.id}`);
}

export async function updateCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = UpdateCompanySchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    industry: formData.get("industry"),
    website: formData.get("website"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postal_code: formData.get("postal_code"),
    country: formData.get("country"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { id, ...data } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: data.name,
      industry: data.industry,
      website: data.website,
      phone: data.phone,
      email: data.email,
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      country: data.country,
      notes: data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/crm/companies/${id}`);
  revalidatePath("/crm/companies");
  return { success: true };
}

// --- Deals ------------------------------------------------------------------

export async function createDeal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = CreateDealSchema.safeParse({
    title: formData.get("title"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    stage_id: formData.get("stage_id"),
    estimated_value: formData.get("estimated_value"),
    expected_event_date: formData.get("expected_event_date"),
    follow_up_date: formData.get("follow_up_date"),
    event_type: formData.get("event_type") ?? "",
    source: formData.get("source"),
    owner_id: formData.get("owner_id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  // Derive status from the chosen stage (won/lost/open), defaulting to open.
  const status = await statusForStage(supabase, data.stage_id);

  const { data: inserted, error } = await supabase
    .from("deals")
    .insert({
      title: data.title,
      contact_id: data.contact_id,
      company_id: data.company_id,
      stage_id: data.stage_id,
      estimated_value: data.estimated_value,
      expected_event_date: data.expected_event_date,
      follow_up_date: data.follow_up_date,
      event_type: data.event_type,
      source: data.source,
      owner_id: data.owner_id,
      notes: data.notes,
      status,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create the deal." };
  }

  revalidatePath("/crm");
  revalidatePath("/crm/deals");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/crm/deals/${inserted.id}`);
}

export async function updateDeal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = UpdateDealSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    stage_id: formData.get("stage_id"),
    estimated_value: formData.get("estimated_value"),
    expected_event_date: formData.get("expected_event_date"),
    follow_up_date: formData.get("follow_up_date"),
    event_type: formData.get("event_type") ?? "",
    source: formData.get("source"),
    owner_id: formData.get("owner_id"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { id, ...data } = parsed.data;
  const supabase = await createClient();

  const update: TablesUpdate<"deals"> = {
    title: data.title,
    contact_id: data.contact_id,
    company_id: data.company_id,
    stage_id: data.stage_id,
    estimated_value: data.estimated_value,
    expected_event_date: data.expected_event_date,
    follow_up_date: data.follow_up_date,
    event_type: data.event_type,
    source: data.source,
    owner_id: data.owner_id,
    notes: data.notes,
    updated_at: new Date().toISOString(),
  };

  // Only reconcile status from the stage when the stage actually moved. A plain
  // edit (e.g. changing the follow-up date) must not clobber a 'won' status set
  // by convertDealToEvent, which leaves the deal on its pre-win stage.
  const { data: current } = await supabase
    .from("deals")
    .select("stage_id")
    .eq("id", id)
    .maybeSingle();
  if (current?.stage_id !== data.stage_id) {
    update.status = await statusForStage(supabase, data.stage_id);
  }

  const { error } = await supabase.from("deals").update(update).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm/deals");
  revalidatePath("/crm");
  return { success: true };
}

/**
 * Move a deal to a stage and reconcile its status: won stages -> 'won', lost
 * stages -> 'lost', otherwise 'open'.
 */
export async function setDealStage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = SetDealStageSchema.safeParse({
    deal_id: formData.get("deal_id"),
    stage_id: formData.get("stage_id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { deal_id, stage_id } = parsed.data;
  const supabase = await createClient();

  const status = await statusForStage(supabase, stage_id);

  const { error } = await supabase
    .from("deals")
    .update({
      stage_id,
      status: status ?? "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", deal_id);

  if (error) return { error: error.message };

  revalidatePath(`/crm/deals/${deal_id}`);
  revalidatePath("/crm/deals");
  revalidatePath("/crm");
  return { success: true };
}

/**
 * Convert a deal into a DRAFT event, copying over its core fields (including the
 * deal's estimated value as the event's contracted total), mark the deal won,
 * then redirect to the new event. The event is born 'draft' on purpose: a
 * client payment against its invoice is what activates it (draft → confirmed),
 * so the same payment gate applies whether the event came from a deal, a quote,
 * or was created by hand. Idempotent: re-converting a deal that already has an
 * event just routes back to that event instead of spawning a duplicate.
 */
export async function convertDealToEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = ConvertDealSchema.safeParse({
    deal_id: formData.get("deal_id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { deal_id } = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select(
      "id, title, contact_id, company_id, event_type, expected_event_date, estimated_value, owner_id",
    )
    .eq("id", deal_id)
    .maybeSingle();

  if (dealError) return { error: dealError.message };
  if (!deal) return { error: "That deal could not be found." };

  // Idempotency: if this deal already became an event, go there.
  const { data: existingEvent } = await supabase
    .from("events")
    .select("id")
    .eq("deal_id", deal.id)
    .limit(1)
    .maybeSingle();
  if (existingEvent?.id) {
    redirect(`/events/${existingEvent.id}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      title: deal.title,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
      event_type: deal.event_type ?? "other",
      event_date: deal.expected_event_date,
      total_amount: deal.estimated_value ?? null,
      status: "draft",
      deal_id: deal.id,
      owner_id: deal.owner_id ?? user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Could not create the event." };
  }

  const { error: updateError } = await supabase
    .from("deals")
    .update({ status: "won", updated_at: new Date().toISOString() })
    .eq("id", deal_id);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/crm/deals/${deal_id}`);
  revalidatePath("/crm/deals");
  revalidatePath("/crm");
  revalidatePath("/events");
  // redirect() throws to navigate — keep it outside any try/catch.
  redirect(`/events/${inserted.id}`);
}

// --- Activities -------------------------------------------------------------

export async function logActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = LogActivitySchema.safeParse({
    type: formData.get("type") ?? undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
    due_at: formData.get("due_at"),
    assigned_to: formData.get("assigned_to"),
    contact_id: formData.get("contact_id"),
    company_id: formData.get("company_id"),
    deal_id: formData.get("deal_id"),
    event_id: formData.get("event_id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const data = parsed.data;
  const user = await getUser();
  const supabase = await createClient();

  const { error } = await supabase.from("activities").insert({
    type: data.type,
    subject: data.subject,
    body: data.body,
    due_at: data.due_at,
    assigned_to: data.assigned_to,
    contact_id: data.contact_id,
    company_id: data.company_id,
    deal_id: data.deal_id,
    event_id: data.event_id,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidateActivity(data);
  return { success: true };
}

export async function completeActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = CompleteActivitySchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();

  const { data: activity, error } = await supabase
    .from("activities")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("contact_id, company_id, deal_id, event_id")
    .maybeSingle();

  if (error) return { error: error.message };

  // Refresh whichever owning entity's detail page the activity belongs to.
  // `parentId` (the caller's current detail page) is always refreshed too.
  if (activity) revalidateActivity(activity);
  const parentId = formData.get("parentId");
  if (typeof parentId === "string" && parentId !== "") {
    revalidatePath(`/crm/contacts/${parentId}`);
    revalidatePath(`/crm/companies/${parentId}`);
    revalidatePath(`/crm/deals/${parentId}`);
  }
  return { success: true };
}

/**
 * Delete an activity / note entered by mistake. Refreshes whichever owning
 * entity (contact / company / deal / event) it was attached to, plus the
 * caller's current detail page. Mirrors completeActivity.
 */
export async function deleteActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEdit("crm");

  const parsed = DeleteActivitySchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();

  const { data: activity, error } = await supabase
    .from("activities")
    .delete()
    .eq("id", parsed.data.id)
    .select("contact_id, company_id, deal_id, event_id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (activity) revalidateActivity(activity);
  const parentId = formData.get("parentId");
  if (typeof parentId === "string" && parentId !== "") {
    revalidatePath(`/crm/contacts/${parentId}`);
    revalidatePath(`/crm/companies/${parentId}`);
    revalidatePath(`/crm/deals/${parentId}`);
    revalidatePath(`/events/${parentId}`);
  }
  return { success: true };
}

// --- Internal helpers -------------------------------------------------------

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve a deal status from a stage: 'won' if the stage is won, 'lost' if
 * lost, otherwise 'open'. A null stage yields 'open'.
 */
async function statusForStage(
  supabase: SupabaseServerClient,
  stageId: string | null,
): Promise<"open" | "won" | "lost"> {
  if (!stageId) return "open";

  const { data } = await supabase
    .from("pipeline_stages")
    .select("is_won, is_lost")
    .eq("id", stageId)
    .maybeSingle();

  if (data?.is_won) return "won";
  if (data?.is_lost) return "lost";
  return "open";
}

/** Revalidate every detail page an activity could be attached to. */
function revalidateActivity(links: {
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  event_id: string | null;
}): void {
  if (links.contact_id) revalidatePath(`/crm/contacts/${links.contact_id}`);
  if (links.company_id) revalidatePath(`/crm/companies/${links.company_id}`);
  if (links.deal_id) revalidatePath(`/crm/deals/${links.deal_id}`);
  if (links.event_id) revalidatePath(`/events/${links.event_id}`);
}
