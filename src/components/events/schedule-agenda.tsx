"use client";

import Link from "next/link";
import type { ScheduleEntryRow } from "@/lib/events/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import {
  computeCrewConflicts,
  type CrewConflict,
} from "@/lib/events/scheduling";

/**
 * Cross-job agenda: schedule entries grouped by day, each row links to its
 * event and shows time, type, status, and the staff assigned. Days/headings
 * render in the business timezone (LA) so this matches the server-rendered
 * "My stops" tab exactly (see scheduling/page.tsx).
 */

// Keep in sync with BUSINESS_TZ in scheduling/page.tsx.
const BUSINESS_TZ = "America/Los_Angeles";

type AgendaEntry = ScheduleEntryRow & {
  event_id: string;
  event_title: string;
  event_type: string;
};

const TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  setup: "Setup",
  teardown: "Teardown",
  site_visit: "Site visit",
  other: "Other",
};

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type.replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-navy">
      {label}
    </span>
  );
}

function dayKey(iso: string): string {
  // en-CA yields YYYY-MM-DD; in BUSINESS_TZ so grouping matches the LA heading.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

function formatDayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TZ,
  });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "All day";
  const fmt = (v: string) =>
    new Date(v).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function assigneeNames(entry: AgendaEntry): string[] {
  return (entry.assignments ?? [])
    .map((a) => a.staff_name)
    .filter((n): n is string => Boolean(n));
}

function ConflictNotice({ conflicts }: { conflicts: CrewConflict[] }) {
  return (
    <div className="mt-3 rounded-(--radius-card) border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <p className="font-medium">Crew double-booked</p>
      <ul className="mt-1 space-y-0.5">
        {conflicts.map((c, i) => (
          <li key={i}>
            {c.staff_name ?? "Someone"} also on{" "}
            {c.other_event_title ?? "another job"}
            {c.other_start
              ? ` (${formatTimeRange(c.other_start, c.other_end)})`
              : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScheduleAgenda({ entries }: { entries: AgendaEntry[] }) {
  const dated = entries.filter((e) => Boolean(e.scheduled_start));

  if (dated.length === 0) {
    return (
      <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
        <p className="eyebrow">Nothing scheduled</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          No deliveries, pickups, setups, or teardowns fall in the next two
          months. Schedule entries you add from an event timeline will surface
          here across every job.
        </p>
      </div>
    );
  }

  const sorted = [...dated].sort(
    (a, b) =>
      new Date(a.scheduled_start as string).getTime() -
      new Date(b.scheduled_start as string).getTime(),
  );

  const { byEntry: conflicts, count: conflictCount } =
    computeCrewConflicts(entries);

  const groups = new Map<string, AgendaEntry[]>();
  for (const entry of sorted) {
    const key = dayKey(entry.scheduled_start as string);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  return (
    <div className="space-y-8">
      {conflictCount > 0 && (
        <div className="rounded-(--radius-card) border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">
            {conflictCount} {conflictCount === 1 ? "stop has" : "stops have"} a
            crew double-booking
          </span>{" "}
          in this window — a crew member is on two overlapping stops. Flagged
          below.
        </div>
      )}
      {[...groups.entries()].map(([key, dayEntries]) => (
        <section key={key}>
          <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="font-display text-lg font-light text-navy">
              {formatDayHeading(dayEntries[0].scheduled_start as string)}
            </h2>
            <span className="text-xs text-muted tabular-nums">
              {dayEntries.length}{" "}
              {dayEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          <ul className="space-y-3">
            {dayEntries.map((entry) => {
              const names = assigneeNames(entry);
              const entryConflicts = conflicts[entry.id];
              return (
                <li
                  key={entry.id}
                  className={`rounded-(--radius-card) border bg-card p-4 transition hover:bg-cream ${
                    entryConflicts ? "border-red-200" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={entry.type} />
                        <span className="text-sm font-medium text-ink tabular-nums">
                          {formatTimeRange(
                            entry.scheduled_start,
                            entry.scheduled_end,
                          )}
                        </span>
                        <StatusBadge status={entry.status} />
                      </div>
                      <Link
                        href={`/events/${entry.event_id}`}
                        className="mt-2 inline-block font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {entry.event_title}
                      </Link>
                      {entry.address && (
                        <p className="mt-1 text-sm text-muted">
                          {entry.address}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="eyebrow">Staff</p>
                      {names.length > 0 ? (
                        <p className="mt-1 max-w-[16rem] text-sm text-ink">
                          {names.join(", ")}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-muted">Unassigned</p>
                      )}
                    </div>
                  </div>
                  {entryConflicts && <ConflictNotice conflicts={entryConflicts} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
