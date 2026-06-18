"use client";

import { useActionState, useState } from "react";
import { createContact, updateContact } from "@/lib/crm/actions";
import type { ActionState, Contact, Option } from "@/lib/crm/types";

/**
 * Contact create/edit form. With no `contact` prop it renders a toggleable
 * "New contact" button that reveals the create form (createContact redirects to
 * the new contact). With a `contact` prop it renders an inline "Edit" toggle
 * bound to updateContact, which revalidates and closes on success. Matches the
 * vendors new-vendor-form / vendor-edit-form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function ContactForm({
  contact,
  companies,
  staff,
  defaultCompanyId,
}: {
  contact?: Contact;
  companies: Option[];
  staff: Option[];
  defaultCompanyId?: string;
}) {
  const editing = Boolean(contact);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateContact : createContact,
    undefined,
  );

  // Close the inline edit form after a successful save.
  if (editing && state?.success && open) {
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          editing
            ? "rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
            : "rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
        }
      >
        {editing ? "Edit" : "New contact"}
      </button>
    );
  }

  const wrapperClass = editing
    ? "mt-6 border-t border-line pt-6"
    : "rounded-(--radius-card) border border-line bg-card p-6";

  return (
    <div className={wrapperClass}>
      <p className="eyebrow mb-4">{editing ? "Edit contact" : "New contact"}</p>
      <form action={action} className="grid gap-5 sm:grid-cols-2">
        {editing && <input type="hidden" name="id" value={contact!.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">First name</span>
          <input
            name="first_name"
            type="text"
            required
            defaultValue={contact?.first_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Last name</span>
          <input
            name="last_name"
            type="text"
            defaultValue={contact?.last_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Company</span>
          <select
            name="company_id"
            defaultValue={contact?.company_id ?? defaultCompanyId ?? ""}
            className={FIELD}
          >
            <option value="">No company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Title</span>
          <input
            name="title"
            type="text"
            placeholder="e.g. Event Coordinator"
            defaultValue={contact?.title ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Phone</span>
          <input
            name="phone"
            type="tel"
            defaultValue={contact?.phone ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Source</span>
          <input
            name="source"
            type="text"
            placeholder="e.g. Referral, Website"
            defaultValue={contact?.source ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Owner</span>
          <select
            name="owner_id"
            defaultValue={contact?.owner_id ?? ""}
            className={FIELD}
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={contact?.notes ?? ""}
            className={`${FIELD} resize-y`}
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
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create contact"}
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
    </div>
  );
}
