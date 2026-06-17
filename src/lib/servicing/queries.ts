import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  EventTicketRow,
  TicketCategory,
  TicketCommentRow,
  TicketDetail,
  TicketFilter,
  TicketFormOptions,
  TicketListRow,
  TicketPriority,
  TicketStatus,
} from "@/lib/servicing/types";

/**
 * Server-only data access for the servicing module. All queries run under the
 * signed-in user's session (RLS). Related rows (event title, client name,
 * assignee profile) are embedded via PostgREST; comment counts are stitched in
 * JS so the resulting view types stay predictable.
 */

// --- Helpers ----------------------------------------------------------------

type ContactName = {
  id: string;
  first_name: string;
  last_name: string | null;
} | null;

function contactName(contact: ContactName): string | null {
  if (!contact) return null;
  const full = [contact.first_name, contact.last_name]
    .filter((p) => p && p.trim() !== "")
    .join(" ")
    .trim();
  return full === "" ? null : full;
}

/** Unresolved (open/in_progress) sort before resolved/closed. */
const STATUS_RANK: Record<string, number> = {
  open: 0,
  in_progress: 0,
  resolved: 1,
  closed: 1,
};

/** urgent > high > medium > low. */
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// --- listTickets ------------------------------------------------------------

/**
 * Every ticket with its event title, client name, assignee name, and comment
 * count. Ordered: unresolved before resolved/closed, then priority
 * urgent>high>medium>low, then created_at desc. Optional status/priority/
 * category filters are applied at the query level.
 */
export async function listTickets(
  filter?: TicketFilter,
): Promise<TicketListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("service_tickets")
    .select(
      "*, events(title), contacts(id, first_name, last_name), profiles!service_tickets_assigned_to_fkey(full_name)",
    );

  if (filter?.status)
    query = query.eq("status", filter.status as TicketStatus);
  if (filter?.priority)
    query = query.eq("priority", filter.priority as TicketPriority);
  if (filter?.category)
    query = query.eq("category", filter.category as TicketCategory);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ticketIds = rows.map((r) => r.id);
  const { data: commentsData, error: commentsError } = await supabase
    .from("ticket_comments")
    .select("ticket_id")
    .in("ticket_id", ticketIds);
  if (commentsError) throw new Error(commentsError.message);

  const commentCounts = new Map<string, number>();
  for (const c of commentsData ?? []) {
    commentCounts.set(c.ticket_id, (commentCounts.get(c.ticket_id) ?? 0) + 1);
  }

  const list: TicketListRow[] = rows.map((row) => {
    const { events, contacts, profiles, ...rest } = row as typeof row & {
      events: { title: string } | null;
      contacts: ContactName;
      profiles: { full_name: string | null } | null;
    };
    return {
      ...rest,
      event_title: events?.title ?? null,
      client_name: contactName(contacts),
      assignee_name: profiles?.full_name ?? null,
      comment_count: commentCounts.get(rest.id) ?? 0,
    };
  });

  list.sort((a, b) => {
    const statusDiff =
      (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
    if (statusDiff !== 0) return statusDiff;
    const prioDiff =
      (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
    if (prioDiff !== 0) return prioDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  return list;
}

// --- getTicket --------------------------------------------------------------

/**
 * A single ticket with event title, client name, assignee name, and its full
 * comment thread (each comment with author name) ordered created_at ASC.
 * Returns null if the ticket does not exist (or is not visible under RLS).
 */
export async function getTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_tickets")
    .select(
      "*, events(title), contacts(id, first_name, last_name), profiles!service_tickets_assigned_to_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { events, contacts, profiles, ...ticket } = data as typeof data & {
    events: { title: string } | null;
    contacts: ContactName;
    profiles: { full_name: string | null } | null;
  };

  const { data: commentsData, error: commentsError } = await supabase
    .from("ticket_comments")
    .select("*, profiles(full_name)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (commentsError) throw new Error(commentsError.message);

  const comments: TicketCommentRow[] = (commentsData ?? []).map((row) => {
    const { profiles: author, ...rest } = row as typeof row & {
      profiles: { full_name: string | null } | null;
    };
    return {
      ...rest,
      author_name: author?.full_name ?? null,
    };
  });

  return {
    ...ticket,
    event_title: events?.title ?? null,
    client_name: contactName(contacts),
    assignee_name: profiles?.full_name ?? null,
    comments,
  };
}

// --- listEventTickets -------------------------------------------------------

/**
 * Tickets logged against a single event, each with assignee name and comment
 * count, newest first — the event-hub servicing panel source.
 */
export async function listEventTickets(
  eventId: string,
): Promise<EventTicketRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_tickets")
    .select(
      "*, profiles!service_tickets_assigned_to_fkey(full_name)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ticketIds = rows.map((r) => r.id);
  const { data: commentsData, error: commentsError } = await supabase
    .from("ticket_comments")
    .select("ticket_id")
    .in("ticket_id", ticketIds);
  if (commentsError) throw new Error(commentsError.message);

  const commentCounts = new Map<string, number>();
  for (const c of commentsData ?? []) {
    commentCounts.set(c.ticket_id, (commentCounts.get(c.ticket_id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const { profiles, ...rest } = row as typeof row & {
      profiles: { full_name: string | null } | null;
    };
    return {
      ...rest,
      assignee_name: profiles?.full_name ?? null,
      comment_count: commentCounts.get(rest.id) ?? 0,
    };
  });
}

// --- listTicketFormOptions --------------------------------------------------

/**
 * Contacts (id + "First Last") and events (id + title) for linking a new
 * ticket. Staff for the assignee picker is sourced from listStaff() in
 * "@/lib/events/queries" — not redefined here.
 */
export async function listTicketFormOptions(): Promise<TicketFormOptions> {
  const supabase = await createClient();

  const [contactsRes, eventsRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true }),
    supabase
      .from("events")
      .select("id, title")
      .order("event_date", { ascending: false, nullsFirst: false }),
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const contacts = (contactsRes.data ?? [])
    .map((c) => ({
      id: c.id,
      label: contactName(c) ?? "Unnamed contact",
    }));

  const events = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
  }));

  return { contacts, events };
}
