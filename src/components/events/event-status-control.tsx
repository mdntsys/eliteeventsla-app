"use client";

import { useActionState } from "react";
import { setEventStatus } from "@/lib/events/actions";
import type { ActionState } from "@/lib/events/types";

const EVENT_STATUSES = [
  "draft",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setEventStatus,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="event_id" value={eventId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy disabled:opacity-60"
      >
        {EVENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
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
