"use client";

import { useActionState, useState } from "react";
import { createTicket } from "@/lib/servicing/actions";
import type { ActionState } from "@/lib/servicing/types";
import type { StaffMember } from "@/lib/events/types";

/**
 * Toggleable inline form to log a new service ticket. Bound to createTicket via
 * useActionState; createTicket redirects to the new ticket on success. Matches
 * the vendors new-vendor-form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const CATEGORIES = [
  "general",
  "delivery",
  "equipment",
  "billing",
  "change_request",
  "complaint",
] as const;

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

function titleize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function NewTicketForm({
  contacts,
  events,
  staff,
}: {
  contacts: { id: string; label: string }[];
  events: { id: string; title: string }[];
  staff: StaffMember[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createTicket,
    undefined,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New ticket
      </button>
    );
  }

  return (
    <form
      action={action}
      className="rounded-(--radius-card) border border-line bg-card p-6"
    >
      <p className="eyebrow mb-3">New ticket</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Subject</span>
          <input
            name="subject"
            type="text"
            required
            placeholder="Short summary of the issue"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Optional detail"
            className={`${FIELD} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Category</span>
          <select name="category" defaultValue="general" className={FIELD}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleize(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Priority</span>
          <select name="priority" defaultValue="medium" className={FIELD}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {titleize(p)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Status</span>
          <select name="status" defaultValue="open" className={FIELD}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleize(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Assignee</span>
          <select name="assigned_to" defaultValue="" className={FIELD}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? "Unnamed"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Event</span>
          <select name="event_id" defaultValue="" className={FIELD}>
            <option value="">No event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Client</span>
          <select name="contact_id" defaultValue="" className={FIELD}>
            <option value="">No client</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create ticket"}
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
