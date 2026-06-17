"use client";

import { useActionState } from "react";
import { updateTicket } from "@/lib/servicing/actions";
import type { ActionState, ServiceTicket } from "@/lib/servicing/types";
import type { StaffMember } from "@/lib/events/types";

/**
 * Inline status / priority / assignee controls for a ticket. Each select
 * submits the whole form on change via updateTicket (hidden id + event_id when
 * present, so the event hub revalidates too).
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-navy disabled:opacity-60";

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function titleize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TicketControls({
  ticket,
  staff,
}: {
  ticket: ServiceTicket;
  staff: StaffMember[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateTicket,
    undefined,
  );

  function submit(e: React.ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="id" value={ticket.id} />
      {ticket.event_id && (
        <input type="hidden" name="event_id" value={ticket.event_id} />
      )}
      {/* preserve category on update */}
      <input type="hidden" name="category" value={ticket.category} />

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted">
          Status
        </span>
        <select
          name="status"
          defaultValue={ticket.status}
          disabled={pending}
          onChange={submit}
          className={FIELD}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleize(s)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted">
          Priority
        </span>
        <select
          name="priority"
          defaultValue={ticket.priority}
          disabled={pending}
          onChange={submit}
          className={FIELD}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {titleize(p)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted">
          Assignee
        </span>
        <select
          name="assigned_to"
          defaultValue={ticket.assigned_to ?? ""}
          disabled={pending}
          onChange={submit}
          className={FIELD}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? "Unnamed"}
            </option>
          ))}
        </select>
      </label>

      {state?.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
