"use client";

import { useActionState, useState } from "react";
import { createDeal, updateDeal } from "@/lib/crm/actions";
import { Modal } from "@/components/ui/modal";
import { ContactSelect } from "@/components/crm/contact-select";
import type { ActionState, Deal, Option } from "@/lib/crm/types";

/**
 * Toggleable form to create or edit a deal, opened in a centered Modal. Bound to
 * createDeal / updateDeal via useActionState; createDeal redirects to the new
 * deal on success, updateDeal returns { success } and we close the form. Selects
 * are fed from the *Options queries. Matches the vendors / servicing form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const EVENT_TYPES = ["corporate", "wedding", "personal", "other"] as const;

function titleize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DealForm({
  deal,
  contacts,
  companies,
  stages,
  admins,
  affiliates,
}: {
  deal?: Deal;
  contacts: Option[];
  companies: Option[];
  stages: Option[];
  admins: Option[];
  affiliates: Option[];
}) {
  const editing = Boolean(deal);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateDeal : createDeal,
    undefined,
  );

  // Close the form after a successful edit save.
  if (editing && state?.success && open) {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          editing
            ? "rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
            : "rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
        }
      >
        {editing ? "Edit" : "New deal"}
      </button>

      {open && (
        <Modal
          title={editing ? "Edit deal" : "New deal"}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="grid gap-3 sm:grid-cols-2">
        {editing && <input type="hidden" name="id" value={deal!.id} />}

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Title</span>
          <input
            name="title"
            type="text"
            required
            defaultValue={deal?.title ?? ""}
            placeholder="e.g. Summer gala — 200 guests"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Stage</span>
          <select
            name="stage_id"
            defaultValue={deal?.stage_id ?? (stages[0]?.id ?? "")}
            className={FIELD}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Event type</span>
          <select
            name="event_type"
            defaultValue={deal?.event_type ?? ""}
            className={FIELD}
          >
            <option value="">—</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleize(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Contact</span>
          <ContactSelect
            name="contact_id"
            contacts={contacts}
            companies={companies}
            defaultValue={deal?.contact_id ?? undefined}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Company</span>
          <select
            name="company_id"
            defaultValue={deal?.company_id ?? ""}
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
          <span className="text-xs text-muted">Lead owner</span>
          <select
            name="owner_id"
            defaultValue={deal?.owner_id ?? ""}
            className={FIELD}
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Follow-up due</span>
          <input
            name="follow_up_date"
            type="date"
            defaultValue={deal?.follow_up_date ?? ""}
            className={FIELD}
          />
        </label>

        {/* Both normally move via "Log a touch" on the deal; editable here so a
            lead chased before that existed can be corrected. Only rendered when
            editing — a brand-new deal starts at zero. */}
        {deal && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Times contacted</span>
              <input
                name="contact_attempts"
                type="number"
                min={0}
                step={1}
                defaultValue={deal.contact_attempts ?? 0}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Last contacted</span>
              <input
                name="last_contacted_at"
                type="date"
                defaultValue={deal.last_contacted_at ?? ""}
                className={FIELD}
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Referred by (affiliate)</span>
          <select
            name="affiliate_id"
            defaultValue={deal?.affiliate_id ?? ""}
            className={FIELD}
          >
            <option value="">None</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Estimated value</span>
          <input
            name="estimated_value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={deal?.estimated_value ?? ""}
            placeholder="—"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Expected event date</span>
          <input
            name="expected_event_date"
            type="date"
            defaultValue={deal?.expected_event_date ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Source</span>
          <input
            name="source"
            type="text"
            defaultValue={deal?.source ?? ""}
            placeholder="e.g. Referral, Website"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-muted">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={deal?.notes ?? ""}
            className={`${FIELD} resize-y`}
          />
        </label>

        {state?.error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {state.error}
          </p>
        )}

        <div className="mt-1 flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create deal"}
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
