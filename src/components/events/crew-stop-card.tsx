"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ScheduleEntryRow, ActionState } from "@/lib/events/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import { ProofUpload } from "@/components/events/proof-upload";
import { updateScheduleStatus, setActualEventTimes } from "@/lib/events/actions";

/**
 * Crew self-service card for a single schedule stop. Mobile-first: stacked,
 * tappable controls. The assignee advances their own stop's status, uploads an
 * arrival photo (delivery_proof), and logs the actual event end. Each mutation
 * is its own <form> bound via useActionState so a pending/error state is
 * isolated per action. Date/time formatting guards against invalid input.
 */

type CrewEntry = ScheduleEntryRow & {
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

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "All day";
  const fmt = (v: string) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

function TypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type.replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-navy">
      {label}
    </span>
  );
}

/** A status-advancing button posting to updateScheduleStatus. */
function StatusButton({
  entryId,
  eventId,
  status,
  label,
  active,
}: {
  entryId: string;
  eventId: string;
  status: "en_route" | "in_progress" | "completed";
  label: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateScheduleStatus,
    undefined,
  );
  return (
    <form action={action} className="contents">
      <input type="hidden" name="id" value={entryId} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending || active}
        aria-pressed={active}
        className={`min-h-10 flex-1 rounded-(--radius-card) border px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
          active
            ? "border-navy bg-navy text-cream"
            : "border-line bg-card text-navy hover:border-navy"
        }`}
      >
        {pending ? "Saving…" : label}
        {state?.error ? (
          <span className="sr-only">{state.error}</span>
        ) : null}
      </button>
    </form>
  );
}

/** Logs the actual event end time (value=now) via setActualEventTimes. */
function LogEndButton({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setActualEventTimes,
    undefined,
  );
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="field" value="end" />
      <input type="hidden" name="value" value="now" />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 w-full rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm font-medium text-navy transition hover:border-navy disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log event ended"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="mt-1 text-xs text-green-700">Event end logged.</p>
      )}
    </form>
  );
}

export function CrewStopCard({ entry }: { entry: CrewEntry }) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={entry.type} />
        <span className="text-sm font-medium text-ink tabular-nums">
          {formatTimeRange(entry.scheduled_start, entry.scheduled_end)}
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
        <p className="mt-1 text-sm text-muted">{entry.address}</p>
      )}

      <div className="mt-4">
        <p className="eyebrow">Update stop</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <StatusButton
            entryId={entry.id}
            eventId={entry.event_id}
            status="en_route"
            label="Mark en route"
            active={entry.status === "en_route"}
          />
          <StatusButton
            entryId={entry.id}
            eventId={entry.event_id}
            status="in_progress"
            label="Mark arrived"
            active={entry.status === "in_progress"}
          />
          <StatusButton
            entryId={entry.id}
            eventId={entry.event_id}
            status="completed"
            label="Mark done"
            active={entry.status === "completed"}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="eyebrow">Arrival photo</p>
        <ProofUpload eventId={entry.event_id} kind="delivery_proof" />
      </div>

      <LogEndButton eventId={entry.event_id} />
    </div>
  );
}
