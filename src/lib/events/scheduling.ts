/**
 * Pure, dependency-free crew double-booking detection. No DB, no React — safe
 * to import from server and client. A crew member is double-booked when they're
 * assigned to two schedule entries whose [start, end) windows overlap (any
 * event). Back-to-back stops (one ends exactly as the next starts) are fine.
 */

export type SchedulingAssignment = {
  // Null for crew-member assignments (no login profile); such rows are skipped
  // by double-booking detection, which only tracks login staff.
  profile_id: string | null;
  staff_name?: string | null;
};

export type SchedulingEntry = {
  id: string;
  event_id?: string;
  event_title?: string | null;
  type?: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assignments?: SchedulingAssignment[] | null;
};

/** One clash on an entry: a person also booked on `other_*` over an overlap. */
export type CrewConflict = {
  profile_id: string;
  staff_name: string | null;
  other_entry_id: string;
  other_event_id: string | null;
  other_event_title: string | null;
  other_type: string | null;
  other_start: string | null;
  other_end: string | null;
};

type Bounded = {
  entry: SchedulingEntry;
  start: number;
  end: number;
  name: string | null;
};

function conflictFrom(
  profile_id: string,
  staff_name: string | null,
  other: SchedulingEntry,
): CrewConflict {
  return {
    profile_id,
    staff_name,
    other_entry_id: other.id,
    other_event_id: other.event_id ?? null,
    other_event_title: other.event_title ?? null,
    other_type: other.type ?? null,
    other_start: other.scheduled_start,
    other_end: other.scheduled_end,
  };
}

/**
 * Returns conflicts keyed by entry id (a plain, serializable object so it can be
 * passed from a server component to a client one), plus a count of distinct
 * entries that have at least one conflict.
 */
export function computeCrewConflicts(entries: SchedulingEntry[]): {
  byEntry: Record<string, CrewConflict[]>;
  count: number;
} {
  // Index time-bounded assignments per person.
  const byPerson = new Map<string, Bounded[]>();
  for (const e of entries) {
    if (!e.scheduled_start || !e.scheduled_end) continue;
    const start = new Date(e.scheduled_start).getTime();
    const end = new Date(e.scheduled_end).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    for (const a of e.assignments ?? []) {
      if (!a.profile_id) continue; // crew member (no login) — not tracked here
      const list = byPerson.get(a.profile_id) ?? [];
      list.push({ entry: e, start, end, name: a.staff_name ?? null });
      byPerson.set(a.profile_id, list);
    }
  }

  const byEntry: Record<string, CrewConflict[]> = {};
  for (const [profile_id, list] of byPerson) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        if (A.entry.id === B.entry.id) continue; // same stop, twice — ignore
        if (A.start < B.end && B.start < A.end) {
          (byEntry[A.entry.id] ||= []).push(
            conflictFrom(profile_id, A.name, B.entry),
          );
          (byEntry[B.entry.id] ||= []).push(
            conflictFrom(profile_id, B.name, A.entry),
          );
        }
      }
    }
  }

  return { byEntry, count: Object.keys(byEntry).length };
}
