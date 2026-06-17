"use client";

import { useActionState, useState } from "react";
import { createInventoryItem } from "@/lib/inventory/actions";
import type { ActionState, InventoryCategory } from "@/lib/inventory/types";

/**
 * Inline "Add item" control. A toggle reveals a form bound to the
 * createInventoryItem server action via useActionState. On success the action
 * redirects to the new item's detail page, so we never need to render a success
 * state here — only the validation/db error path.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function NewItemForm({
  categories,
}: {
  categories: InventoryCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bulk" | "serialized">("bulk");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInventoryItem,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Add item
      </button>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">New</p>
          <h2 className="font-display mt-0.5 text-xl font-light text-navy">
            Add inventory item
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm text-muted transition hover:text-ink"
        >
          Cancel
        </button>
      </div>

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
          <span className="eyebrow">Type</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "bulk" | "serialized")
            }
            className={FIELD}
          >
            <option value="bulk">Bulk (tracked by quantity)</option>
            <option value="serialized">Serialized (tracked by unit)</option>
          </select>
        </label>

        {kind === "bulk" && (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Quantity</span>
            <input
              name="quantity"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              className={FIELD}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">SKU</span>
          <input name="sku" type="text" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Location</span>
          <input name="location" type="text" className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Daily rate</span>
          <input
            name="daily_rate"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Replacement cost</span>
          <input
            name="replacement_cost"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea name="description" rows={3} className={FIELD} />
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
            {pending ? "Saving…" : "Save item"}
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
