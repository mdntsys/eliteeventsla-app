"use client";

import { useActionState, useState } from "react";
import { updateVendor } from "@/lib/vendors/actions";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/vendors/types";
import type { Database } from "@/lib/database.types";

type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
type VendorCategory = Database["public"]["Tables"]["vendor_categories"]["Row"];

/**
 * Inline edit control for a vendor. A toggle reveals a form bound to the
 * updateVendor server action via useActionState. The action revalidates the
 * detail + list paths, so the page re-renders with fresh data on success; we
 * close the form once a submission succeeds.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function VendorEditForm({
  vendor,
  categories,
}: {
  vendor: Vendor;
  categories: VendorCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateVendor,
    undefined,
  );

  // Close the form after a successful save.
  if (state?.success && open) {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
      >
        Edit
      </button>

      {open && (
        <Modal title="Edit vendor" onClose={() => setOpen(false)}>
          <form action={action} className="grid gap-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={vendor.id} />

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={vendor.name}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Category</span>
          <select
            name="category_id"
            defaultValue={vendor.category_id ?? ""}
            className={FIELD}
          >
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
          <select
            name="status"
            defaultValue={vendor.status}
            className={FIELD}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Contact name</span>
          <input
            name="contact_name"
            type="text"
            defaultValue={vendor.contact_name ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={vendor.email ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Phone</span>
          <input
            name="phone"
            type="tel"
            defaultValue={vendor.phone ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Website</span>
          <input
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={vendor.website ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Address</span>
          <input
            name="address"
            type="text"
            defaultValue={vendor.address ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Rating (0–5)</span>
          <input
            name="rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            defaultValue={vendor.rating ?? ""}
            placeholder="—"
            className={FIELD}
          />
        </label>

        <label className="flex items-center gap-2.5 sm:self-end sm:pb-2.5">
          <input
            name="preferred"
            type="checkbox"
            value="true"
            defaultChecked={vendor.preferred}
            className="h-4 w-4 rounded border-line text-navy focus:ring-navy"
          />
          <span className="text-sm text-ink">Preferred vendor</span>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={vendor.notes ?? ""}
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
            {pending ? "Saving…" : "Save changes"}
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
