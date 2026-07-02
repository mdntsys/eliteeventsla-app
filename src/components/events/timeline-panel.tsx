"use client";

import { useActionState, useState } from "react";
import {
  addScheduleEntry,
  assignStaff,
  unassignStaff,
  updateScheduleStatus,
  deleteScheduleEntry,
} from "@/lib/events/actions";
import type {
  ActionState,
  AssignmentRow,
  EventDetail,
  ScheduleEntryRow,
  StaffMember,
} from "@/lib/events/types";
import type { CrewConflict } from "@/lib/events/scheduling";
import { StatusBadge } from "@/components/inventory/status-badge";
import { CrewAssignSelect } from "@/components/events/crew-assign-select";

type CrewOption = { id: string; label: string };

/**
 * Timeline + staff surface for a single event. Lists schedule entries (delivery,
 * pickup, setup, …) each with an inline status control, its staff assignments
 * (with remove), and an "assign staff" control. Plus an "add schedule entry"
 * form. Each form binds to its own server action via useActionState.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";

const SCHEDULE_TYPES = [
  { value: "delivery", label: "Delivery" },
  { value: "pickup", label: "Pickup" },
  { value: "setup", label: "Setup" },
  { value: "teardown", label: "Teardown" },
  { value: "site_visit", label: "Site visit" },
  { value: "other", label: "Other" },
] as const;

const SCHEDULE_STATUSES = [
  "scheduled",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  en_route: "En route",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  setup: "Setup",
  teardown: "Teardown",
  site_visit: "Site visit",
  other: "Other",
};

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Time TBD";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

function ScheduleStatusControl({ entryId, status }: { entryId: string; status: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateScheduleStatus,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={entryId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${FIELD} py-1.5`}
      >
        {SCHEDULE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SCHEDULE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function UnassignButton({ assignmentId }: { assignmentId: string }) {
  const [, action, pending] = useActionState<ActionState, FormData>(
    unassignStaff,
    undefined,
  );
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Remove assignment"
        className="text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        ×
      </button>
    </form>
  );
}

function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteScheduleEntry,
    undefined,
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Remove this stop? Its crew assignments are removed too.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={entryId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function AssignmentRowView({ assignment }: { assignment: AssignmentRow }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm">
      <span className="text-ink">
        {assignment.staff_name ?? "Unknown"}
        {assignment.role_on_job && (
          <span className="ml-2 text-xs text-muted">{assignment.role_on_job}</span>
        )}
      </span>
      <UnassignButton assignmentId={assignment.id} />
    </li>
  );
}

function AssignStaffForm({
  entryId,
  staff,
  crew,
}: {
  entryId: string;
  staff: StaffMember[];
  crew: CrewOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    assignStaff,
    undefined,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-start gap-2">
      <input type="hidden" name="schedule_entry_id" value={entryId} />
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Assign</span>
        <CrewAssignSelect staff={staff} crew={crew} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Role on job</span>
        <input name="role_on_job" type="text" placeholder="e.g. Lead" className={FIELD} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-[1.35rem] rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm font-medium text-navy transition hover:border-navy disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function formatOther(start: string | null, end: string | null): string {
  if (!start) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function ScheduleEntryCard({
  entry,
  staff,
  crew,
  conflicts,
}: {
  entry: ScheduleEntryRow;
  staff: StaffMember[];
  crew: CrewOption[];
  conflicts?: CrewConflict[];
}) {
  return (
    <li className="rounded-(--radius-card) border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-navy">
              {TYPE_LABELS[entry.type] ?? entry.type}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <p className="mt-1 text-sm text-ink">
            {formatRange(entry.scheduled_start, entry.scheduled_end)}
          </p>
          {entry.address && (
            <p className="mt-0.5 text-xs text-muted">{entry.address}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ScheduleStatusControl entryId={entry.id} status={entry.status} />
          <DeleteEntryButton entryId={entry.id} />
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="eyebrow">Crew</p>
        {entry.assignments.length === 0 ? (
          <p className="mt-1 text-xs text-muted">No staff assigned yet.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {entry.assignments.map((a) => (
              <AssignmentRowView key={a.id} assignment={a} />
            ))}
          </ul>
        )}
        <AssignStaffForm entryId={entry.id} staff={staff} crew={crew} />

        {conflicts && conflicts.length > 0 && (
          <div className="mt-3 rounded-(--radius-card) border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <p className="font-medium">Crew double-booked</p>
            <ul className="mt-1 space-y-0.5">
              {conflicts.map((c, i) => (
                <li key={i}>
                  {c.staff_name ?? "Someone"} also on{" "}
                  {c.other_event_title ?? "another job"}
                  {c.other_start ? ` (${formatOther(c.other_start, c.other_end)})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function AddScheduleEntryForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addScheduleEntry,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm font-medium text-navy transition hover:border-navy"
      >
        Add schedule entry
      </button>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 rounded-(--radius-card) border border-line bg-card p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Type</span>
        <select name="type" defaultValue="delivery" className={FIELD}>
          {SCHEDULE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Address</span>
        <input name="address" type="text" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Start *</span>
        <input
          name="scheduled_start"
          type="datetime-local"
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">End</span>
        <input name="scheduled_end" type="datetime-local" className={FIELD} />
      </label>
      <p className="text-xs text-muted sm:col-span-2">
        A start time is required so the stop and its crew show up on the
        Scheduling agenda.
      </p>

      {state?.error && (
        <p role="alert" className="text-xs text-red-700 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add entry"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TimelinePanel({
  ev,
  staff,
  crew,
  crewConflicts,
}: {
  ev: EventDetail;
  staff: StaffMember[];
  crew: CrewOption[];
  crewConflicts?: Record<string, CrewConflict[]>;
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Logistics</p>
          <h2 className="font-display mt-0.5 text-xl font-light text-navy">
            Timeline &amp; crew
          </h2>
        </div>
        <AddScheduleEntryForm eventId={ev.id} />
      </div>

      {ev.schedule.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-8 text-center text-sm text-muted">
          No deliveries, pickups, or visits scheduled yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ev.schedule.map((entry) => (
            <ScheduleEntryCard
              key={entry.id}
              entry={entry}
              staff={staff}
              crew={crew}
              conflicts={crewConflicts?.[entry.id]}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
