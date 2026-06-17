"use client";

import { useActionState } from "react";
import { setItemLocation } from "@/lib/inventory/actions";
import type { ActionState } from "@/lib/inventory/types";
import type { LocationOption } from "@/lib/locations/types";
import { LocationFields } from "@/components/inventory/location-fields";

type Props = {
  itemId: string;
  options: LocationOption[];
  defaultLocationId?: string | null;
  defaultRowId?: string | null;
  defaultSection?: string | null;
};

export function ItemLocationForm({
  itemId,
  options,
  defaultLocationId,
  defaultRowId,
  defaultSection,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setItemLocation,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="item_id" value={itemId} />
      <LocationFields
        options={options}
        defaultLocationId={defaultLocationId}
        defaultRowId={defaultRowId}
        defaultSection={defaultSection}
        idPrefix={`item-${itemId}`}
      />

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700">Location updated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save location"}
      </button>
    </form>
  );
}
