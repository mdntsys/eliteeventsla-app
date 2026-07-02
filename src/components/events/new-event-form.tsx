"use client";

import { useActionState, useState } from "react";
import { createEvent } from "@/lib/events/actions";
import { Modal } from "@/components/ui/modal";
import { ContactSelect } from "@/components/crm/contact-select";
import type { ActionState } from "@/lib/events/types";

/**
 * Inline "New event" control on the events list. A toggle reveals a form bound
 * to the createEvent server action via useActionState. On success the action
 * redirects to the new event's detail page, so only the validation/db error
 * path is rendered here.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const EVENT_TYPES = [
  { value: "corporate", label: "Corporate" },
  { value: "wedding", label: "Wedding" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
] as const;

type Option = { id: string; label: string };

export function NewEventForm({
  contacts,
  companies,
}: {
  contacts: Option[];
  companies: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createEvent,
    undefined,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New event
      </button>

      {open && (
        <Modal title="Create event" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="eyebrow">Title</span>
              <input name="title" type="text" required className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Event type</span>
              <select name="event_type" defaultValue="corporate" className={FIELD}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Event date</span>
              <input name="event_date" type="date" className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Client contact</span>
              <ContactSelect
                name="contact_id"
                contacts={contacts}
                companies={companies}
                placeholder="None"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Company</span>
              <select name="company_id" defaultValue="" className={FIELD}>
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Venue</span>
              <input name="venue_name" type="text" className={FIELD} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Guest count</span>
              <input
                name="guest_count"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                className={FIELD}
              />
            </label>

            {state?.error && (
              <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                {state.error}
              </p>
            )}

            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create event"}
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
        </Modal>
      )}
    </>
  );
}
