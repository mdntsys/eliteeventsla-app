"use client";

import { useState, useTransition } from "react";
import { bulkAssignLocation } from "@/lib/inventory/actions";
import type { LocationOption } from "@/lib/locations/types";

/**
 * Action bar shown when one or more inventory rows are selected: pick a storage
 * location (and optional warehouse row) and assign it to the whole batch in one
 * go — "assign all to Alvy Warehouse / Delia's". Clearing the location unassigns
 * it. Clears the selection on success.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy";

export function BulkLocationBar({
  selectedIds,
  locationOptions,
  onAssigned,
}: {
  selectedIds: string[];
  locationOptions: LocationOption[];
  onAssigned: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState("");
  const selectedLoc = locationOptions.find((l) => l.id === locationId) ?? null;
  const rows = selectedLoc?.rows ?? [];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await bulkAssignLocation(undefined, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        setLocationId("");
        onAssigned();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-navy/20 bg-navy/5 px-4 py-3"
    >
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="item_ids" value={id} />
      ))}

      <span className="text-sm font-medium text-navy">
        {selectedIds.length} selected
      </span>

      <span className="text-sm text-muted">Assign to</span>

      <select
        name="location_id"
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        className={FIELD}
      >
        <option value="">Unassign location</option>
        {locationOptions.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>

      {rows.length > 0 && (
        <select key={locationId} name="row_id" defaultValue="" className={FIELD}>
          <option value="">No row</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              Row {row.label}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        disabled={pending || selectedIds.length === 0}
        className="rounded-(--radius-card) bg-navy px-4 py-1.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Assigning…" : "Assign"}
      </button>

      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
