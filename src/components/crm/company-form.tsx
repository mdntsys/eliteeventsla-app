"use client";

import { useActionState, useState } from "react";
import { createCompany, updateCompany } from "@/lib/crm/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState, Company } from "@/lib/crm/types";

/**
 * Company create/edit form. With no `company` prop it renders a "New company"
 * button; with one it renders an "Edit" button. Either way the form opens in a
 * centered Modal (createCompany redirects to the new company; updateCompany
 * revalidates and closes on success). Ownership lives on contacts, not
 * companies (individual clients often have no company; deals carry their own
 * sales owner), so there is no Owner field here.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function CompanyForm({ company }: { company?: Company }) {
  const editing = Boolean(company);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateCompany : createCompany,
    undefined,
  );

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
        {editing ? "Edit" : "New company"}
      </button>

      {open && (
        <Modal
          title={editing ? "Edit company" : "New company"}
          onClose={() => setOpen(false)}
        >
          <form action={action} className="grid gap-5 sm:grid-cols-2">
            {editing && <input type="hidden" name="id" value={company!.id} />}

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="eyebrow">Name</span>
              <input
                name="name"
                type="text"
                required
                defaultValue={company?.name ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Industry</span>
              <input
                name="industry"
                type="text"
                placeholder="e.g. Hospitality"
                defaultValue={company?.industry ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Website</span>
              <input
                name="website"
                type="url"
                placeholder="https://"
                defaultValue={company?.website ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Email</span>
              <input
                name="email"
                type="email"
                defaultValue={company?.email ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Phone</span>
              <input
                name="phone"
                type="tel"
                defaultValue={company?.phone ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="eyebrow">Address line 1</span>
              <input
                name="address_line1"
                type="text"
                defaultValue={company?.address_line1 ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="eyebrow">Address line 2</span>
              <input
                name="address_line2"
                type="text"
                defaultValue={company?.address_line2 ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">City</span>
              <input
                name="city"
                type="text"
                defaultValue={company?.city ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">State</span>
              <input
                name="state"
                type="text"
                defaultValue={company?.state ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Postal code</span>
              <input
                name="postal_code"
                type="text"
                defaultValue={company?.postal_code ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Country</span>
              <input
                name="country"
                type="text"
                defaultValue={company?.country ?? ""}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="eyebrow">Notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={company?.notes ?? ""}
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
                    : "Create company"}
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
