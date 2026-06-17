"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createTicket } from "@/lib/servicing/actions";
import type { ActionState, EventTicketRow } from "@/lib/servicing/types";
import type { StaffMember } from "@/lib/events/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import { PriorityBadge } from "@/components/servicing/priority-badge";

/**
 * SERVICING surface for the event hub. Lists the client-service tickets logged
 * against this job (subject, priority, status, assignee, comment count) and
 * offers a compact "Log ticket" form bound to createTicket with the event_id
 * pinned, so a new ticket is filed straight onto the job. Mirrors the styling of
 * the other event-hub panels (EventVendorsPanel et al.).
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const TICKET_CATEGORIES = [
  "general",
  "delivery",
  "equipment",
  "billing",
  "change_request",
  "complaint",
] as const;

const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/* ── Ticket row ──────────────────────────────────────────────────────── */

function TicketRow({ row }: { row: EventTicketRow }) {
  return (
    <li className="flex items-start justify-between gap-4 bg-cream px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/operations/servicing/${row.id}`}
          className="text-sm font-medium text-ink transition hover:text-navy"
        >
          {row.subject}
        </Link>
        <p className="mt-0.5 text-xs text-muted">
          {titleCase(row.category)}
          {row.assignee_name ? ` · ${row.assignee_name}` : " · Unassigned"}
          {` · ${row.comment_count} ${
            row.comment_count === 1 ? "note" : "notes"
          }`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={row.priority} />
        <StatusBadge status={row.status} />
      </div>
    </li>
  );
}

/* ── Log ticket form ─────────────────────────────────────────────────── */

function LogTicketForm({
  eventId,
  staff,
}: {
  eventId: string;
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
        className="mt-6 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Log ticket
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 border-t border-line pt-6">
      <input type="hidden" name="event_id" value={eventId} />
      <p className="eyebrow mb-3">Log ticket</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Subject</span>
          <input
            name="subject"
            type="text"
            required
            placeholder="What needs attention?"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Category</span>
          <select name="category" defaultValue="general" className={FIELD}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Priority</span>
          <select name="priority" defaultValue="medium" className={FIELD}>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {titleCase(p)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Assignee</span>
          <select name="assigned_to" defaultValue="" className={FIELD}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name ?? "Unnamed"}
                {s.role ? ` (${s.role})` : ""}
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
          {pending ? "Logging…" : "Log ticket"}
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

/* ── Panel ───────────────────────────────────────────────────────────── */

export function EventTicketsPanel({
  eventId,
  rows,
  staff,
}: {
  eventId: string;
  rows: EventTicketRow[];
  staff: StaffMember[];
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Servicing</h2>
        <span className="eyebrow">{rows.length} on this job</span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No service tickets on this job yet. Log one below to track it.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {rows.map((row) => (
            <TicketRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <LogTicketForm eventId={eventId} staff={staff} />
    </section>
  );
}
