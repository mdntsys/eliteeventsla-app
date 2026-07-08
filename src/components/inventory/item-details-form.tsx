"use client";

import { useActionState } from "react";
import { updateInventoryItem } from "@/lib/inventory/actions";
import type { ActionState, InventoryCategory } from "@/lib/inventory/types";

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

type Props = {
  itemId: string;
  categories: InventoryCategory[];
  defaultName: string;
  defaultSku: string | null;
  defaultCategoryId: string | null;
  defaultDailyRate: number | null;
  defaultReplacementCost: number | null;
  defaultDescription: string | null;
};

/**
 * Edit an item's core details (name, SKU, category, daily rate, replacement
 * cost, description) from its detail page. Location, status, and quantity have
 * their own controls.
 */
export function ItemDetailsForm({
  itemId,
  categories,
  defaultName,
  defaultSku,
  defaultCategoryId,
  defaultDailyRate,
  defaultReplacementCost,
  defaultDescription,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateInventoryItem,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="item_id" value={itemId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={defaultName}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">SKU</span>
          <input
            name="sku"
            type="text"
            defaultValue={defaultSku ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Category</span>
          <select
            name="category_id"
            defaultValue={defaultCategoryId ?? ""}
            className={FIELD}
          >
            <option value="">— none —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Daily rate</span>
          <input
            name="daily_rate"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            defaultValue={defaultDailyRate ?? ""}
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
            defaultValue={defaultReplacementCost ?? ""}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={defaultDescription ?? ""}
            className={FIELD}
          />
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700">Details updated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
