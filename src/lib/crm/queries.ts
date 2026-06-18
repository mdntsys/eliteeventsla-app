import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ActivityView,
  CompanyDetail,
  CompanyListRow,
  ContactDetail,
  ContactListRow,
  DealDetail,
  DealRow,
  Option,
  PipelineColumn,
  PipelineStage,
} from "@/lib/crm/types";

/**
 * Server-only data access for the CRM module. All queries run under the
 * signed-in user's session (RLS). Related rows (company name, contact name,
 * stage name, assignee profile) are embedded via PostgREST; counts that
 * PostgREST cannot express directly are stitched in JS so the resulting view
 * types stay predictable.
 */

// --- Helpers ----------------------------------------------------------------

type ContactNameRow = {
  first_name: string;
  last_name: string | null;
} | null;

/** "First Last", trimmed; null when there is no usable name. */
function contactName(contact: ContactNameRow): string | null {
  if (!contact) return null;
  const full = [contact.first_name, contact.last_name]
    .filter((p) => p && p.trim() !== "")
    .join(" ")
    .trim();
  return full === "" ? null : full;
}

// --- Contacts ---------------------------------------------------------------

/**
 * Every contact with its company name and a count of its open deals, ordered
 * by name (first, then last).
 */
export async function listContacts(): Promise<ContactListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*, companies(name), deals(id, status)")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  type ContactWithJoins = ContactListRow & {
    companies: { name: string } | null;
    deals: { id: string; status: string }[] | null;
  };

  const contacts = (data ?? []) as unknown as ContactWithJoins[];

  return contacts.map((c) => {
    const { companies, deals, ...rest } = c;
    return {
      ...rest,
      company_name: companies?.name ?? null,
      open_deals: (deals ?? []).filter((d) => d.status === "open").length,
    };
  });
}

/**
 * A single contact with its company name, activity log (each with assignee
 * name, soonest-due/newest first), and its deals. Returns null if the contact
 * does not exist (or is not visible under RLS).
 */
export async function getContact(id: string): Promise<ContactDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("*, companies(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { companies, ...contact } = data as typeof data & {
    companies: { name: string } | null;
  };

  const [activitiesRes, dealsRes] = await Promise.all([
    supabase
      .from("activities")
      .select("*, profiles!activities_assigned_to_fkey(full_name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deals")
      .select("id, title, status")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (activitiesRes.error) throw new Error(activitiesRes.error.message);
  if (dealsRes.error) throw new Error(dealsRes.error.message);

  return {
    ...contact,
    company_name: companies?.name ?? null,
    activities: mapActivities(activitiesRes.data),
    deals: (dealsRes.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
    })),
  };
}

// --- Companies --------------------------------------------------------------

/** Every company with its contact and deal counts, alphabetical by name. */
export async function listCompanies(): Promise<CompanyListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*, contacts(id), deals(id)")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  type CompanyWithJoins = CompanyListRow & {
    contacts: { id: string }[] | null;
    deals: { id: string }[] | null;
  };

  const companies = (data ?? []) as unknown as CompanyWithJoins[];

  return companies.map((c) => {
    const { contacts, deals, ...rest } = c;
    return {
      ...rest,
      contact_count: contacts?.length ?? 0,
      deal_count: deals?.length ?? 0,
    };
  });
}

/**
 * A single company with its contacts and deals (each deal carrying its stage
 * name). Returns null if the company does not exist (or is not visible under
 * RLS).
 */
export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [contactsRes, dealsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .order("first_name", { ascending: true }),
    supabase
      .from("deals")
      .select("id, title, status, pipeline_stages(name)")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (dealsRes.error) throw new Error(dealsRes.error.message);

  type DealWithStage = {
    id: string;
    title: string;
    status: string;
    pipeline_stages: { name: string } | null;
  };

  const deals = (dealsRes.data ?? []) as unknown as DealWithStage[];

  return {
    ...data,
    contacts: contactsRes.data ?? [],
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      stage_name: d.pipeline_stages?.name ?? null,
    })),
  };
}

// --- Pipeline & deals -------------------------------------------------------

/** Every pipeline stage in sort order. */
export async function listPipelineStages(): Promise<PipelineStage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The pipeline board: one column per stage (in sort order), each carrying the
 * deals currently in that stage. Each deal carries contact/company/stage
 * names. Deals with no stage are dropped from the board.
 */
export async function listPipeline(): Promise<PipelineColumn[]> {
  const [stages, deals] = await Promise.all([listPipelineStages(), listDeals()]);

  const byStage = new Map<string, DealRow[]>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const deal of deals) {
    if (deal.stage_id && byStage.has(deal.stage_id)) {
      byStage.get(deal.stage_id)!.push(deal);
    }
  }

  return stages.map((stage) => ({
    stage,
    deals: byStage.get(stage.id) ?? [],
  }));
}

/** Every deal joined to contact, company, and stage names, newest first. */
export async function listDeals(): Promise<DealRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      "*, contacts(first_name, last_name), companies(name), pipeline_stages(name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type DealWithJoins = DealRow & {
    contacts: ContactNameRow;
    companies: { name: string } | null;
    pipeline_stages: { name: string } | null;
  };

  const deals = (data ?? []) as unknown as DealWithJoins[];

  return deals.map((d) => {
    const { contacts, companies, pipeline_stages, ...rest } = d;
    return {
      ...rest,
      contact_name: contactName(contacts),
      company_name: companies?.name ?? null,
      stage_name: pipeline_stages?.name ?? null,
    };
  });
}

/**
 * A single deal with contact/company/stage names and its activity log (each
 * with assignee name, newest first). Returns null if the deal does not exist
 * (or is not visible under RLS).
 */
export async function getDeal(id: string): Promise<DealDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .select(
      "*, contacts(first_name, last_name), companies(name), pipeline_stages(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { contacts, companies, pipeline_stages, ...deal } =
    data as typeof data & {
      contacts: ContactNameRow;
      companies: { name: string } | null;
      pipeline_stages: { name: string } | null;
    };

  const { data: activitiesData, error: activitiesError } = await supabase
    .from("activities")
    .select("*, profiles!activities_assigned_to_fkey(full_name)")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  if (activitiesError) throw new Error(activitiesError.message);

  return {
    ...deal,
    contact_name: contactName(contacts),
    company_name: companies?.name ?? null,
    stage_name: pipeline_stages?.name ?? null,
    activities: mapActivities(activitiesData),
  };
}

// --- Form options -----------------------------------------------------------

/** Contacts (id + "First Last") for a form select, alphabetical. */
export async function listContactOptions(): Promise<Option[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    label: contactName(c) ?? "Unnamed contact",
  }));
}

/** Companies (id + name) for a form select, alphabetical. */
export async function listCompanyOptions(): Promise<Option[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({ id: c.id, label: c.name }));
}

/** Active staff with a role (id + name) for an assignee select, by name. */
export async function listStaffOptions(): Promise<Option[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .not("role", "is", null)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.full_name ?? "Unnamed",
  }));
}

// --- Follow-ups -------------------------------------------------------------

/**
 * Open follow-ups: activities with a due date that are not yet completed,
 * soonest due first — the CRM dashboard "upcoming" feed.
 */
export async function upcomingFollowUps(): Promise<ActivityView[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("*, profiles!activities_assigned_to_fkey(full_name)")
    .not("due_at", "is", null)
    .is("completed_at", null)
    .order("due_at", { ascending: true });

  if (error) throw new Error(error.message);
  return mapActivities(data);
}

// --- Shared activity mapping ------------------------------------------------

type ActivityJoinRow = ActivityView & {
  profiles: { full_name: string | null } | null;
};

/** Map embedded activity rows to ActivityView, lifting the assignee name. */
function mapActivities(
  rows: { profiles: { full_name: string | null } | null }[] | null,
): ActivityView[] {
  return ((rows ?? []) as ActivityJoinRow[]).map((row) => {
    const { profiles, ...rest } = row;
    return { ...rest, assignee_name: profiles?.full_name ?? null };
  });
}
