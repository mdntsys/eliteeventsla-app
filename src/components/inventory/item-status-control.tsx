"use client";

import { useActionState } from "react";
import { updateItemStatus } from "@/lib/inventory/actions";
import type { ActionState } from "@/lib/inventory/types";

const ITEM_STATUSES = ["available", "maintenance", "retired"] as const;

export function ItemStatusControl({
  itemId,
  status,
}: {
  itemId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateItemStatus,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="item_id" value={itemId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy disabled:opacity-60"
      >
        {ITEM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
