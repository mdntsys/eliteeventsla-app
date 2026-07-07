"use client";

import { useActionState } from "react";
import { deleteInventoryItem } from "@/lib/inventory/actions";
import type { ActionState } from "@/lib/inventory/types";

/**
 * "Delete item" control for genuine mistakes (typos, duplicates). The server
 * action only allows the delete when the item has NO event reservation history;
 * an item that's been used on jobs is protected and returns a friendly message
 * telling you to retire it instead. Guards a mis-click with a confirm; on
 * success deleteInventoryItem redirects to the inventory list.
 */
export function DeleteItemButton({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteInventoryItem,
    undefined,
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${itemName}”? This permanently removes the item and its units. Only do this for something entered by mistake — this can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-1"
    >
      <input type="hidden" name="item_id" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete item"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
