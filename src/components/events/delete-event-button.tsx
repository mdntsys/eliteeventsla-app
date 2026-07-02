"use client";

import { useActionState } from "react";
import { deleteEvent } from "@/lib/events/actions";
import type { ActionState } from "@/lib/events/types";

/**
 * "Delete event" control for the event hub. Deleting cascades the event's
 * schedule, reserved items, vendors, and activity log; an event with recorded
 * payments is protected server-side (ON DELETE RESTRICT) and returns a friendly
 * error instead. Guards a mis-click with a confirm; deleteEvent redirects to the
 * events list on success.
 */
export function DeleteEventButton({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteEvent,
    undefined,
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${eventTitle}”? This removes its schedule, reserved items, vendors, and notes. This can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-1"
    >
      <input type="hidden" name="id" value={eventId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete event"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
