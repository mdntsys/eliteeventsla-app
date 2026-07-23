import "server-only";

import { createClient } from "@/lib/supabase/server";
import { pacificToday } from "@/lib/time";
import type { Database } from "@/lib/database.types";

/**
 * Server-only aggregate queries powering the role-aware ops dashboard. All
 * queries run under the signed-in user's session (RLS broad read for roled
 * users). Related rows (event title/type, item/unit names, vendor names,
 * assignee names) are embedded via PostgREST; light aggregation/ordering is
 * stitched in JS where that keeps the embeds simple and the types predictable.
 * Every date column is nullable, so callers must guard against null/NaN.
 */

type ScheduleType = Database["public"]["Enums"]["schedule_type"];
type ScheduleStatus = Database["public"]["Enums"]["schedule_status"];
type EventVendorStatus = Database["public"]["Enums"]["event_vendor_status"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type EventStatus = Database["public"]["Enums"]["event_status"];
type ActivityType = Database["public"]["Enums"]["activity_type"];

// --- View types (exported) --------------------------------------------------

export type ScheduleItem = {
  id: string;
  event_id: string;
  event_title: string;
  type: ScheduleType;
  status: ScheduleStatus;
  scheduled_start: string;
  assignees: string[];
};

export type ReturnItem = {
  id: string;
  event_id: string;
  event_title: string;
  label: string;
  checked_out_at: string;
};

export type VendorPending = {
  id: string;
  event_id: string;
  event_title: string;
  vendor_name: string;
  service: string | null;
};

export type HotTicket = {
  id: string;
  event_id: string | null;
  event_title: string | null;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
};

export type StatusCount = {
  status: EventStatus;
  count: number;
};

export type FollowUp = {
  id: string;
  subject: string;
  /** null for a deal's own follow-up date (no activity type behind it). */
  type: ActivityType | null;
  due_at: string;
  href: string;
  label: string;
  /** True once the due date has passed — the card renders these in red. */
  overdue: boolean;
};

export type StaleLead = {
  id: string;
  title: string;
  contact_name: string | null;
  contact_attempts: number;
  follow_up_date: string | null;
  last_contacted_at: string | null;
  /** Whole days past the follow-up date; null when no date was ever set. */
  days_overdue: number | null;
  href: string;
};

// --- upcomingLogistics ------------------------------------------------------

/**
 * Schedule entries with a scheduled_start in [now, now+days], joined to their
 * event (title/type) and staff assignee names, ordered by soonest start.
 */
export async function upcomingLogistics(days = 7): Promise<ScheduleItem[]> {
  const supabase = await createClient();

  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("schedule_entries")
    .select(
      "id, event_id, type, status, scheduled_start, events(title), schedule_assignments(profiles(full_name))",
    )
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", now.toISOString())
    .lte("scheduled_start", until.toISOString())
    .order("scheduled_start", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    event_id: string;
    type: ScheduleType;
    status: ScheduleStatus;
    scheduled_start: string | null;
    events: { title: string } | null;
    schedule_assignments:
      | { profiles: { full_name: string | null } | null }[]
      | null;
  };

  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    if (!row.scheduled_start) return [];
    const assignees = (row.schedule_assignments ?? [])
      .map((a) => a.profiles?.full_name ?? null)
      .filter((n): n is string => !!n && n.trim() !== "");
    return [
      {
        id: row.id,
        event_id: row.event_id,
        event_title: row.events?.title ?? "Untitled event",
        type: row.type,
        status: row.status,
        scheduled_start: row.scheduled_start,
        assignees,
      },
    ];
  });
}

// --- pendingReturns ---------------------------------------------------------

/**
 * Reserved items that are checked out but not yet returned, joined to event
 * title, inventory item name, and unit asset tag. Oldest-out first.
 */
export async function pendingReturns(): Promise<ReturnItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_items")
    .select(
      "id, event_id, checked_out_at, events(title), inventory_items(name), inventory_units(asset_tag)",
    )
    .not("checked_out_at", "is", null)
    .is("returned_at", null)
    .order("checked_out_at", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    event_id: string;
    checked_out_at: string | null;
    events: { title: string } | null;
    inventory_items: { name: string } | null;
    inventory_units: { asset_tag: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    if (!row.checked_out_at) return [];
    const name = row.inventory_items?.name ?? "Unknown item";
    const tag = row.inventory_units?.asset_tag;
    const label = tag ? `${name} (${tag})` : name;
    return [
      {
        id: row.id,
        event_id: row.event_id,
        event_title: row.events?.title ?? "Untitled event",
        label,
        checked_out_at: row.checked_out_at,
      },
    ];
  });
}

// --- unconfirmedVendors -----------------------------------------------------

/**
 * Vendor lines still in the 'proposed' state, joined to event title, vendor
 * name, and service.
 */
export async function unconfirmedVendors(): Promise<VendorPending[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_vendors")
    .select("id, event_id, service, events(title), vendors(name)")
    .eq("status", "proposed" satisfies EventVendorStatus)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    event_id: string;
    service: string | null;
    events: { title: string } | null;
    vendors: { name: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    event_id: row.event_id,
    event_title: row.events?.title ?? "Untitled event",
    vendor_name: row.vendors?.name ?? "Unknown vendor",
    service: row.service,
  }));
}

// --- openHotTickets ---------------------------------------------------------

/**
 * Open or in-progress tickets at urgent/high priority, joined to event title,
 * newest first.
 */
export async function openHotTickets(): Promise<HotTicket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_tickets")
    .select("id, event_id, subject, priority, status, events(title)")
    .in("priority", ["urgent", "high"] satisfies TicketPriority[])
    .in("status", ["open", "in_progress"] satisfies TicketStatus[])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    event_id: string | null;
    subject: string;
    priority: TicketPriority;
    status: TicketStatus;
    events: { title: string } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    event_id: row.event_id,
    event_title: row.events?.title ?? null,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
  }));
}

// --- jobsByStatus -----------------------------------------------------------

/**
 * Event counts grouped by lifecycle status, in canonical pipeline order.
 * Statuses with zero events are omitted.
 */
export async function jobsByStatus(): Promise<StatusCount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("events").select("status");
  if (error) throw new Error(error.message);

  const counts = new Map<EventStatus, number>();
  for (const row of (data ?? []) as { status: EventStatus }[]) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  const ORDER: EventStatus[] = [
    "draft",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
  ];

  return ORDER.filter((status) => counts.has(status)).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

// --- upcomingFollowUps ------------------------------------------------------

/**
 * Open (not-yet-completed) activities that have a due date, soonest-due first,
 * each with a derived deep-link href + label to its primary related record
 * (deal > contact > company > event, falling back to the CRM index).
 */
/**
 * Everything owed a nudge, from BOTH places a follow-up can live:
 *
 *  1. activities.due_at  — an explicit task/reminder someone logged
 *  2. deals.follow_up_date — the date typed straight onto the deal
 *
 * (2) used to be invisible here, so a rep who set a follow-up date on a deal —
 * the normal way it's done — saw nothing on the dashboard and the date quietly
 * went by. Won/lost deals are excluded: a closed deal must not keep nagging.
 *
 * Both sources are merged, sorted by due date (soonest first, overdue at the
 * top), and trimmed to `limit`.
 */
export async function upcomingFollowUps(limit = 8): Promise<FollowUp[]> {
  const supabase = await createClient();

  const [activityResult, dealResult] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id, subject, type, due_at, deal_id, contact_id, company_id, event_id",
      )
      .not("due_at", "is", null)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(limit),
    supabase
      .from("deals")
      .select("id, title, follow_up_date, contacts(first_name, last_name)")
      .not("follow_up_date", "is", null)
      .eq("status", "open")
      .order("follow_up_date", { ascending: true })
      .limit(limit),
  ]);

  const { data } = activityResult;
  if (activityResult.error) throw new Error(activityResult.error.message);
  if (dealResult.error) throw new Error(dealResult.error.message);

  type Row = {
    id: string;
    subject: string | null;
    type: ActivityType;
    due_at: string | null;
    deal_id: string | null;
    contact_id: string | null;
    company_id: string | null;
    event_id: string | null;
  };

  const now = Date.now();

  const fromActivities = ((data ?? []) as unknown as Row[]).flatMap((row) => {
    if (!row.due_at) return [];

    let href = "/crm";
    let label = "CRM";
    if (row.deal_id) {
      href = `/crm/deals/${row.deal_id}`;
      label = "Deal";
    } else if (row.contact_id) {
      href = `/crm/contacts/${row.contact_id}`;
      label = "Contact";
    } else if (row.company_id) {
      href = `/crm/companies/${row.company_id}`;
      label = "Company";
    } else if (row.event_id) {
      href = `/events/${row.event_id}`;
      label = "Event";
    }

    return [
      {
        id: row.id,
        subject: row.subject ?? "Untitled activity",
        type: row.type,
        due_at: row.due_at,
        href,
        label,
        overdue: new Date(row.due_at).getTime() < now,
      },
    ];
  });

  type DealRow = {
    id: string;
    title: string | null;
    follow_up_date: string | null;
    contacts: { first_name: string | null; last_name: string | null } | null;
  };

  const fromDeals = ((dealResult.data ?? []) as unknown as DealRow[]).flatMap(
    (row) => {
      if (!row.follow_up_date) return [];
      const who = [row.contacts?.first_name, row.contacts?.last_name]
        .filter(Boolean)
        .join(" ");
      return [
        {
          id: `deal:${row.id}`,
          subject: row.title ?? "Untitled deal",
          type: null,
          // A pure DATE column: pin it to end-of-day UTC so a follow-up dated
          // today doesn't sort (or read) as already overdue this morning.
          due_at: `${row.follow_up_date}T23:59:59Z`,
          href: `/crm/deals/${row.id}`,
          label: who ? `Deal · ${who}` : "Deal",
          overdue: new Date(`${row.follow_up_date}T23:59:59Z`).getTime() < now,
        },
      ];
    },
  );

  return [...fromActivities, ...fromDeals]
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, limit);
}

/**
 * Leads that look dead: an OPEN deal that's been chased at least twice, or whose
 * follow-up date has come and gone. These are what clog the pipeline — the
 * dashboard surfaces them so they can be marked lost or removed rather than
 * sitting there forever.
 *
 * Ordered most-chased first, then longest overdue.
 */
export async function staleLeads(
  minAttempts = 2,
  limit = 8,
): Promise<StaleLead[]> {
  const supabase = await createClient();

  const today = pacificToday();

  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, title, contact_attempts, follow_up_date, last_contacted_at, contacts(first_name, last_name)",
    )
    .eq("status", "open")
    .or(`contact_attempts.gte.${minAttempts},follow_up_date.lt.${today}`)
    .limit(50);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    title: string | null;
    contact_attempts: number | null;
    follow_up_date: string | null;
    last_contacted_at: string | null;
    contacts: { first_name: string | null; last_name: string | null } | null;
  };

  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  const DAY_MS = 86_400_000;

  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const name = [row.contacts?.first_name, row.contacts?.last_name]
        .filter(Boolean)
        .join(" ");
      const daysOverdue = row.follow_up_date
        ? Math.floor(
            (todayMs - new Date(`${row.follow_up_date}T00:00:00Z`).getTime()) /
              DAY_MS,
          )
        : null;
      return {
        id: row.id,
        title: row.title ?? "Untitled deal",
        contact_name: name || null,
        contact_attempts: row.contact_attempts ?? 0,
        follow_up_date: row.follow_up_date,
        last_contacted_at: row.last_contacted_at,
        days_overdue: daysOverdue != null && daysOverdue > 0 ? daysOverdue : null,
        href: `/crm/deals/${row.id}`,
      };
    })
    .sort(
      (a, b) =>
        b.contact_attempts - a.contact_attempts ||
        (b.days_overdue ?? 0) - (a.days_overdue ?? 0),
    )
    .slice(0, limit);
}
