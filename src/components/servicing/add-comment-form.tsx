"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTicketComment } from "@/lib/servicing/actions";
import type { ActionState } from "@/lib/servicing/types";

/**
 * Add a note to a ticket thread. Bound to addTicketComment via useActionState;
 * clears the textarea on success. The hidden event_id lets the action
 * revalidate the linked event hub too.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function AddCommentForm({
  ticketId,
  eventId,
}: {
  ticketId: string;
  eventId?: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addTicketComment,
    undefined,
  );
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.success && ref.current) {
      ref.current.value = "";
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="ticket_id" value={ticketId} />
      {eventId && <input type="hidden" name="event_id" value={eventId} />}
      <textarea
        ref={ref}
        name="body"
        rows={3}
        required
        placeholder="Add a note…"
        className={`${FIELD} resize-y`}
      />
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Posting…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
