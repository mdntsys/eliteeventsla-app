import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Availability,
  AvailabilityUnit,
  AssignmentRow,
  AttachmentRow,
  EventDetail,
  EventInvoiceRow,
  EventItemRow,
  EventListRow,
  EventOption,
  EventPickList,
  PickListGroup,
  PickListLine,
  ScheduleEntryRow,
  StaffMember,
} from "@/lib/events/types";
import {
  computeCrewConflicts,
  type CrewConflict,
  type SchedulingEntry,
} from "@/lib/events/scheduling";

/**
 * Server-only data access for the event/job lifecycle. All queries run under
 * the signed-in user's session (RLS). We fetch related rows and stitch them in
 * JS to keep PostgREST embeds simple and the resulting types predictable.
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

/** Two windows overlap when a.start < b.end AND a.end > b.start. */
function overlaps(
  aFrom: string | null,
  aTo: string | null,
  bFrom: string,
  bTo: string,
): boolean {
  // A reserved line with no window is treated as always-on (conservative).
  const from = aFrom ?? "-infinity";
  const to = aTo ?? "infinity";
  return from < bTo && to > bFrom;
}

// --- listEvents -------------------------------------------------------------

/**
 * Every event with its client/company name, reserved item count, and the
 * soonest upcoming schedule entry. Aggregates are stitched in JS.
 */
export async function listEvents(): Promise<EventListRow[]> {
  const supabase = await createClient();

  const { data: eventsData, error: eventsError } = await supabase
    .from("events")
    .select(
      "*, contacts(id, first_name, last_name), companies(id, name)",
    )
    .order("event_date", { ascending: true, nullsFirst: false });

  if (eventsError) throw new Error(eventsError.message);
  const events = eventsData ?? [];
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);

  const [itemsRes, scheduleRes, invoicesRes] = await Promise.all([
    supabase
      .from("event_items")
      .select("id, event_id")
      .in("event_id", eventIds),
    supabase
      .from("schedule_entries")
      .select("event_id, scheduled_start")
      .in("event_id", eventIds)
      .not("scheduled_start", "is", null),
    supabase
      .from("invoices")
      .select("event_id, total_amount, amount_paid, status")
      .in("event_id", eventIds)
      .neq("status", "void"),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);
  if (invoicesRes.error) throw new Error(invoicesRes.error.message);

  const itemCounts = new Map<string, number>();
  for (const row of itemsRes.data ?? []) {
    itemCounts.set(row.event_id, (itemCounts.get(row.event_id) ?? 0) + 1);
  }

  // Per-event billing rollup (non-void invoices), for the list's payment badge.
  const billing = new Map<string, { invoiced: number; paid: number }>();
  for (const row of invoicesRes.data ?? []) {
    if (!row.event_id) continue;
    const acc = billing.get(row.event_id) ?? { invoiced: 0, paid: 0 };
    acc.invoiced += row.total_amount ?? 0;
    acc.paid += row.amount_paid ?? 0;
    billing.set(row.event_id, acc);
  }

  const nowISO = new Date().toISOString();
  const nextSchedule = new Map<string, string>();
  for (const row of scheduleRes.data ?? []) {
    const start = row.scheduled_start;
    if (!start || start < nowISO) continue;
    const current = nextSchedule.get(row.event_id);
    if (!current || start < current) {
      nextSchedule.set(row.event_id, start);
    }
  }

  return events.map((event) => {
    const { contacts, companies, ...rest } = event as typeof event & {
      contacts: ContactName;
      companies: { id: string; name: string } | null;
    };
    const bill = billing.get(event.id) ?? { invoiced: 0, paid: 0 };
    const payment_state: EventListRow["payment_state"] =
      bill.invoiced <= 0
        ? "unbilled"
        : bill.paid >= bill.invoiced
          ? "paid"
          : bill.paid > 0
            ? "partial"
            : "unpaid";
    return {
      ...rest,
      client_name: contactName(contacts),
      company_name: companies?.name ?? null,
      item_count: itemCounts.get(event.id) ?? 0,
      next_schedule_at: nextSchedule.get(event.id) ?? null,
      invoiced: bill.invoiced,
      paid: bill.paid,
      payment_state,
    };
  });
}

// --- getEvent ---------------------------------------------------------------

/**
 * A single event with client/company names, reserved items (joined to
 * inventory item name/kind and unit asset tag), schedule entries with their
 * staff assignments, and attachments each carrying a fresh signed URL.
 * Returns null if the event does not exist (or is not visible under RLS).
 */
export async function getEvent(id: string): Promise<EventDetail | null> {
  const supabase = await createClient();

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select(
      "*, contacts(id, first_name, last_name, media_release_consent), companies(id, name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (eventError) throw new Error(eventError.message);
  if (!eventData) return null;

  const { contacts, companies, ...event } = eventData as typeof eventData & {
    contacts:
      | (ContactName & { media_release_consent: boolean | null })
      | null;
    companies: { id: string; name: string } | null;
  };

  const [itemsRes, scheduleRes, attachmentsRes] = await Promise.all([
    supabase
      .from("event_items")
      .select(
        "*, inventory_items(name, kind), inventory_units(asset_tag)",
      )
      .eq("event_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("schedule_entries")
      .select("*")
      .eq("event_id", id)
      .order("scheduled_start", { ascending: true, nullsFirst: false }),
    supabase
      .from("event_attachments")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (scheduleRes.error) throw new Error(scheduleRes.error.message);
  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);

  const items: EventItemRow[] = (itemsRes.data ?? []).map((row) => {
    const { inventory_items, inventory_units, ...rest } = row as typeof row & {
      inventory_items: { name: string; kind: "bulk" | "serialized" } | null;
      inventory_units: { asset_tag: string | null } | null;
    };
    return {
      ...rest,
      item_name: inventory_items?.name ?? "Unknown item",
      item_kind: inventory_items?.kind ?? "bulk",
      unit_asset_tag: inventory_units?.asset_tag ?? null,
    };
  });

  // Assignments for all schedule entries on this event, joined to profiles.
  const entries = scheduleRes.data ?? [];
  const entryIds = entries.map((e) => e.id);
  const assignmentsByEntry = new Map<string, AssignmentRow[]>();
  if (entryIds.length > 0) {
    const { data: asgData, error: asgError } = await supabase
      .from("schedule_assignments")
      .select("*, profiles(full_name, role), crew_members(name)")
      .in("schedule_entry_id", entryIds)
      .order("created_at", { ascending: true });
    if (asgError) throw new Error(asgError.message);

    for (const row of asgData ?? []) {
      const { profiles, crew_members, ...rest } = row as typeof row & {
        profiles: { full_name: string | null; role: string | null } | null;
        crew_members: { name: string | null } | null;
      };
      // A stop's crew is either a staff profile or a lightweight crew member.
      const assignment: AssignmentRow = {
        ...rest,
        staff_name: profiles?.full_name ?? crew_members?.name ?? null,
        staff_role: profiles?.role ?? (crew_members ? "crew" : null),
      };
      const list = assignmentsByEntry.get(rest.schedule_entry_id) ?? [];
      list.push(assignment);
      assignmentsByEntry.set(rest.schedule_entry_id, list);
    }
  }

  const schedule: ScheduleEntryRow[] = entries.map((entry) => ({
    ...entry,
    assignments: assignmentsByEntry.get(entry.id) ?? [],
  }));

  // Sign all attachment URLs in ONE batch call (createSignedUrls) rather than
  // one Storage round-trip per attachment. The returned array is positionally
  // aligned with the input paths; a failed path yields a null url.
  const attachmentRows = attachmentsRes.data ?? [];
  let attachments: AttachmentRow[] = [];
  if (attachmentRows.length > 0) {
    const { data: signedList } = await supabase.storage
      .from("operations-proofs")
      .createSignedUrls(
        attachmentRows.map((a) => a.storage_path),
        3600,
      );
    attachments = attachmentRows.map((att, i) => ({
      ...att,
      signed_url: signedList?.[i]?.signedUrl ?? null,
    }));
  }

  return {
    ...event,
    client_name: contactName(contacts),
    company_name: companies?.name ?? null,
    contact_media_release: contacts?.media_release_consent ?? null,
    items,
    schedule,
    attachments,
  };
}

// --- listEventOptions -------------------------------------------------------

/** Turn a date-ish value into a YYYY-MM-DD string for a <input type="date">. */
function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/**
 * Events as compact options for the inventory tab's "reserve for an event"
 * picker: id, a readable label, and a default reserve window. Cancelled events
 * are excluded; most recent first.
 */
export async function listEventOptions(): Promise<EventOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, start_at, end_at, status")
    .neq("status", "cancelled")
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((ev) => {
    const from = toDateInput(ev.start_at) || toDateInput(ev.event_date);
    const to = toDateInput(ev.end_at) || toDateInput(ev.event_date);
    const dateLabel = ev.event_date
      ? new Date(`${ev.event_date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    return {
      id: ev.id,
      label: dateLabel ? `${ev.title} · ${dateLabel}` : ev.title,
      defaultFrom: from,
      defaultTo: to,
    };
  });
}

// --- getEventPickList -------------------------------------------------------

/**
 * A warehouse pick list for one event: every reserved line grouped by the
 * physical location it's pulled from (a serialized line follows its unit's
 * location; a bulk line follows the item's). Returns null if the event is not
 * visible. Groups are ordered by location name with "Unassigned" last.
 */
export async function getEventPickList(
  eventId: string,
): Promise<EventPickList | null> {
  const supabase = await createClient();

  const { data: ev, error: evError } = await supabase
    .from("events")
    .select("id, title, event_date, venue_name, start_at, end_at")
    .eq("id", eventId)
    .maybeSingle();

  if (evError) throw new Error(evError.message);
  if (!ev) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from("event_items")
    .select(
      "quantity, unit_id, inventory_items(name, kind, location_id, row_id, section), inventory_units(asset_tag, location_id, row_id, section)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  type Row = {
    quantity: number | null;
    unit_id: string | null;
    inventory_items: {
      name: string;
      kind: "bulk" | "serialized";
      location_id: string | null;
      row_id: string | null;
      section: string | null;
    } | null;
    inventory_units: {
      asset_tag: string | null;
      location_id: string | null;
      row_id: string | null;
      section: string | null;
    } | null;
  };
  const rows = (itemsData ?? []) as Row[];

  // Resolve every referenced location + row name in two batched lookups.
  const locationIds = new Set<string>();
  const rowIds = new Set<string>();
  for (const r of rows) {
    const loc = r.inventory_units?.location_id ?? r.inventory_items?.location_id;
    const row = r.inventory_units?.row_id ?? r.inventory_items?.row_id;
    if (loc) locationIds.add(loc);
    if (row) rowIds.add(row);
  }

  const [locationsRes, rowsRes] = await Promise.all([
    locationIds.size > 0
      ? supabase.from("locations").select("id, name").in("id", Array.from(locationIds))
      : Promise.resolve({ data: [], error: null }),
    rowIds.size > 0
      ? supabase.from("warehouse_rows").select("id, label").in("id", Array.from(rowIds))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);

  const locationNames = new Map<string, string>();
  for (const l of locationsRes.data ?? []) locationNames.set(l.id, l.name);
  const rowLabels = new Map<string, string>();
  for (const r of rowsRes.data ?? []) rowLabels.set(r.id, r.label);

  // Group lines by their "where to pull it" label (location + row).
  const groups = new Map<string, PickListLine[]>();
  let totalUnits = 0;
  for (const r of rows) {
    const item = r.inventory_items;
    if (!item) continue;
    const isSerialized = item.kind === "serialized";
    const locId = r.inventory_units?.location_id ?? item.location_id;
    const rowId = r.inventory_units?.row_id ?? item.row_id;
    const section = r.inventory_units?.section ?? item.section;

    const locName = locId ? (locationNames.get(locId) ?? null) : null;
    const rowLabel = rowId ? (rowLabels.get(rowId) ?? null) : null;
    const groupLabel = locName
      ? rowLabel
        ? `${locName} · Row ${rowLabel}`
        : locName
      : "Unassigned";

    const qty = r.quantity ?? 1;
    totalUnits += isSerialized ? 1 : qty;

    const line: PickListLine = {
      name: item.name,
      kind: item.kind,
      detail: isSerialized
        ? (r.inventory_units?.asset_tag ?? "Any available unit")
        : `×${qty}`,
      section,
    };
    const list = groups.get(groupLabel) ?? [];
    list.push(line);
    groups.set(groupLabel, list);
  }

  const orderedGroups: PickListGroup[] = Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    })
    .map(([location, lines]) => ({
      location,
      lines: lines.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  // A compact date window string for the header (or null).
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  let windowStr: string | null = null;
  if (ev.start_at && ev.end_at) windowStr = `${fmt(ev.start_at)} – ${fmt(ev.end_at)}`;
  else if (ev.start_at || ev.end_at) windowStr = fmt((ev.start_at ?? ev.end_at) as string);

  return {
    event: {
      id: ev.id,
      title: ev.title,
      event_date: ev.event_date,
      venue_name: ev.venue_name,
      window: windowStr,
    },
    groups: orderedGroups,
    totalLines: rows.length,
    totalUnits,
  };
}

// --- listStaff --------------------------------------------------------------

/** Active staff with a role, ordered by name — the assignment picker source. */
export async function listStaff(): Promise<StaffMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .not("role", "is", null)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffMember[];
}

/**
 * Active crew members (id + name) for the assignment picker — the lightweight,
 * non-login people who work events. Ordered by name.
 */
export async function listCrew(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crew_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.id, label: c.name }));
}

// --- checkAvailability ------------------------------------------------------

/**
 * Availability of an inventory item over [fromISO, toISO]. For serialized
 * items, walks each unit and flags conflicts from non-returned reservations
 * overlapping the window (or maintenance/retired status). For bulk items,
 * sums reserved quantity from overlapping non-returned reservations.
 * `excludeEventId` lets the job's own reservations show as available.
 */
export async function checkAvailability(
  inventoryItemId: string,
  fromISO: string,
  toISO: string,
  excludeEventId?: string,
): Promise<Availability> {
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, kind, quantity")
    .eq("id", inventoryItemId)
    .maybeSingle();

  if (itemError) throw new Error(itemError.message);
  if (!item) {
    return { kind: "bulk", total: 0, reserved: 0, available: 0, units: [] };
  }

  if (item.kind === "serialized") {
    const [unitsRes, reservationsRes] = await Promise.all([
      supabase
        .from("inventory_units")
        .select("id, asset_tag, status")
        .eq("item_id", inventoryItemId)
        .order("asset_tag", { ascending: true }),
      supabase
        .from("event_items")
        .select(
          "id, unit_id, event_id, reserved_from, reserved_to, returned_at, events(title)",
        )
        .eq("inventory_item_id", inventoryItemId)
        .is("returned_at", null)
        .not("unit_id", "is", null),
    ]);

    if (unitsRes.error) throw new Error(unitsRes.error.message);
    if (reservationsRes.error) throw new Error(reservationsRes.error.message);

    type Reservation = {
      unit_id: string | null;
      event_id: string;
      reserved_from: string | null;
      reserved_to: string | null;
      events: { title: string } | null;
    };
    const reservations = (reservationsRes.data ?? []) as Reservation[];

    // unit_id -> first conflicting reservation in this window.
    const conflictByUnit = new Map<
      string,
      { event_id: string; title: string | null }
    >();
    for (const r of reservations) {
      if (!r.unit_id) continue;
      if (excludeEventId && r.event_id === excludeEventId) continue;
      if (!overlaps(r.reserved_from, r.reserved_to, fromISO, toISO)) continue;
      if (!conflictByUnit.has(r.unit_id)) {
        conflictByUnit.set(r.unit_id, {
          event_id: r.event_id,
          title: r.events?.title ?? null,
        });
      }
    }

    const units: AvailabilityUnit[] = (unitsRes.data ?? []).map((u) => {
      const conflict = conflictByUnit.get(u.id);
      const blockedByStatus =
        u.status === "maintenance" || u.status === "retired";
      const available = !conflict && !blockedByStatus;
      return {
        unit_id: u.id,
        asset_tag: u.asset_tag,
        available,
        conflict_event_id: conflict?.event_id ?? null,
        conflict_event_title: conflict?.title ?? null,
      };
    });

    const total = units.length;
    const available = units.filter((u) => u.available).length;
    return {
      kind: "serialized",
      total,
      reserved: total - available,
      available,
      units,
    };
  }

  // Bulk: sum reserved quantity from overlapping, non-returned reservations.
  const { data: reservationsData, error: reservationsError } = await supabase
    .from("event_items")
    .select("event_id, quantity, reserved_from, reserved_to")
    .eq("inventory_item_id", inventoryItemId)
    .is("returned_at", null);

  if (reservationsError) throw new Error(reservationsError.message);

  let reserved = 0;
  for (const r of reservationsData ?? []) {
    if (excludeEventId && r.event_id === excludeEventId) continue;
    if (!overlaps(r.reserved_from, r.reserved_to, fromISO, toISO)) continue;
    reserved += r.quantity ?? 0;
  }

  const total = item.quantity ?? 0;
  const available = Math.max(0, total - reserved);
  return { kind: "bulk", total, reserved, available, units: [] };
}

// --- listScheduleInRange ----------------------------------------------------

/**
 * Schedule entries whose scheduled_start falls in [fromISO, toISO], joined to
 * their event (title/type) and staff assignments — the cross-job calendar lens.
 */
export async function listScheduleInRange(
  fromISO: string,
  toISO: string,
): Promise<
  Array<
    ScheduleEntryRow & {
      event_id: string;
      event_title: string;
      event_type: string;
    }
  >
> {
  const supabase = await createClient();

  const { data: entriesData, error: entriesError } = await supabase
    .from("schedule_entries")
    .select("*, events(title, event_type)")
    .gte("scheduled_start", fromISO)
    .lte("scheduled_start", toISO)
    .order("scheduled_start", { ascending: true });

  if (entriesError) throw new Error(entriesError.message);
  const entries = entriesData ?? [];
  if (entries.length === 0) return [];

  const entryIds = entries.map((e) => e.id);
  const assignmentsByEntry = new Map<string, AssignmentRow[]>();

  const { data: asgData, error: asgError } = await supabase
    .from("schedule_assignments")
    .select("*, profiles(full_name, role), crew_members(name)")
    .in("schedule_entry_id", entryIds)
    .order("created_at", { ascending: true });

  if (asgError) throw new Error(asgError.message);

  for (const row of asgData ?? []) {
    const { profiles, crew_members, ...rest } = row as typeof row & {
      profiles: { full_name: string | null; role: string | null } | null;
      crew_members: { name: string | null } | null;
    };
    // A stop's crew is either a staff profile or a lightweight crew member.
    const assignment: AssignmentRow = {
      ...rest,
      staff_name: profiles?.full_name ?? crew_members?.name ?? null,
      staff_role: profiles?.role ?? (crew_members ? "crew" : null),
    };
    const list = assignmentsByEntry.get(rest.schedule_entry_id) ?? [];
    list.push(assignment);
    assignmentsByEntry.set(rest.schedule_entry_id, list);
  }

  return entries.map((entry) => {
    const { events, ...rest } = entry as typeof entry & {
      events: { title: string; event_type: string } | null;
    };
    return {
      ...rest,
      assignments: assignmentsByEntry.get(rest.id) ?? [],
      event_id: rest.event_id,
      event_title: events?.title ?? "Untitled event",
      event_type: events?.event_type ?? "other",
    };
  });
}

/**
 * Crew double-booking conflicts for one event's schedule entries, keyed by
 * entry id. Looks across every event the assigned people appear on, so a clash
 * with another job surfaces right where crew is assigned. Returns {} when the
 * event has no time-bounded, staffed stops.
 */
export async function getEventCrewConflicts(
  eventId: string,
): Promise<Record<string, CrewConflict[]>> {
  const supabase = await createClient();

  // This event's entries + who's on them.
  const { data: mineData, error: mineError } = await supabase
    .from("schedule_entries")
    .select("id, schedule_assignments(profile_id)")
    .eq("event_id", eventId);
  if (mineError) throw new Error(mineError.message);

  const mine = (mineData ?? []) as {
    id: string;
    schedule_assignments: { profile_id: string | null }[] | null;
  }[];
  const myEntryIds = new Set(mine.map((e) => e.id));
  // Only login staff (profile_id) participate in double-booking detection; crew
  // members have no profile_id, so filter the nulls out.
  const profileIds = Array.from(
    new Set(
      mine
        .flatMap((e) => (e.schedule_assignments ?? []).map((a) => a.profile_id))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (profileIds.length === 0) return {};

  // Every stop those people are assigned to, on any event, with windows + names.
  const { data: allData, error: allError } = await supabase
    .from("schedule_assignments")
    .select(
      "profile_id, profiles(full_name), schedule_entries(id, event_id, type, scheduled_start, scheduled_end, events(title))",
    )
    .in("profile_id", profileIds);
  if (allError) throw new Error(allError.message);

  type AssignRow = {
    profile_id: string;
    profiles: { full_name: string | null } | null;
    schedule_entries: {
      id: string;
      event_id: string;
      type: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      events: { title: string | null } | null;
    } | null;
  };

  const entries = new Map<string, SchedulingEntry>();
  for (const row of (allData ?? []) as unknown as AssignRow[]) {
    const se = row.schedule_entries;
    if (!se) continue;
    const existing = entries.get(se.id);
    const assignment = {
      profile_id: row.profile_id,
      staff_name: row.profiles?.full_name ?? null,
    };
    if (existing) {
      existing.assignments?.push(assignment);
    } else {
      entries.set(se.id, {
        id: se.id,
        event_id: se.event_id,
        event_title: se.events?.title ?? null,
        type: se.type,
        scheduled_start: se.scheduled_start,
        scheduled_end: se.scheduled_end,
        assignments: [assignment],
      });
    }
  }

  const { byEntry } = computeCrewConflicts(Array.from(entries.values()));
  // Only return conflicts attached to this event's own stops.
  const result: Record<string, CrewConflict[]> = {};
  for (const [entryId, conflicts] of Object.entries(byEntry)) {
    if (myEntryIds.has(entryId)) result[entryId] = conflicts;
  }
  return result;
}

/**
 * Invoices billed against an event, newest first — powers the event hub's
 * billing-readiness panel. Readable by any role (broad RLS read); writes stay
 * accounting/admin, so the panel only links into Accounting for those roles.
 */
export async function listEventInvoices(
  eventId: string,
): Promise<EventInvoiceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total_amount, amount_paid, due_date, issued_date",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventInvoiceRow[];
}
