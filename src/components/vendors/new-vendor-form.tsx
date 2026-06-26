"use client";

import { useActionState, useState } from "react";
import { createVendor } from "@/lib/vendors/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/vendors/types";
import type { Database } from "@/lib/database.types";

type VendorCategory = Database["public"]["Tables"]["vendor_categories"]["Row"];

/**
 * Inline "New vendor" control. A toggle reveals a form bound to the createVendor
 * server action via useActionState. On success the action redirects to the new
 * vendor's detail page, so only the validation/db error path renders here.
 * Mirrors the inventory new-item-form pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function NewVendorForm({ categories }: { categories: VendorCategory[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createVendor,
    undefined,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        New vendor
      </button>

      {open && (
        <Modal title="New vendor" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Name</span>
          <input name="name" type="text" required className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Category</span>
          <select name="category_id" defaultValue="" className={FIELD}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Status</span>
          <select name="status" defaultValue="active" className={FIELD}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Contact name</span>
          <input name="contact_name" type="text" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <input name="email" type="email" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Phone</span>
          <input name="phone" type="tel" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Website</span>
          <input
            name="website"
            type="url"
            placeholder="https://"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Address</span>
          <input name="address" type="text" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Rating (0–5)</span>
          <input
            name="rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            placeholder="—"
            className={FIELD}
          />
        </label>

        <label className="flex items-center gap-2.5 sm:self-end sm:pb-2.5">
          <input
            name="preferred"
            type="checkbox"
            value="true"
            className="h-4 w-4 rounded border-line text-navy focus:ring-navy"
          />
          <span className="text-sm text-ink">Preferred vendor</span>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Notes</span>
          <textarea name="notes" rows={3} className={FIELD} />
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
            {pending ? "Saving…" : "Save vendor"}
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
