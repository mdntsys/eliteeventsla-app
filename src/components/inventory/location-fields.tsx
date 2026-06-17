"use client";

import { useState } from "react";
import type { LocationOption } from "@/lib/locations/types";

/**
 * Reusable Location field group shared by the create-item form, the add-unit
 * form, and the inline edit-location controls. Renders a Location <select>; when
 * the selected location is a warehouse it also reveals a Row <select> and a
 * Section <input>. For offsite locations no row/section are rendered (empty ⇒
 * the server actions coerce "" → null).
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function LocationFields({
  options,
  defaultLocationId = null,
  defaultRowId = null,
  defaultSection = null,
  idPrefix = "loc",
}: {
  options: LocationOption[];
  defaultLocationId?: string | null;
  defaultRowId?: string | null;
  defaultSection?: string | null;
  idPrefix?: string;
}) {
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? "");
  const selected = options.find((o) => o.id === locationId) ?? null;
  const isWarehouse = selected?.kind === "warehouse";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="eyebrow">Location</span>
        <select
          id={`${idPrefix}-location_id`}
          name="location_id"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className={FIELD}
        >
          <option value="">— none —</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}{" "}
              {option.kind === "warehouse" ? "(Warehouse)" : "(Off-site)"}
            </option>
          ))}
        </select>
      </label>

      {isWarehouse && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Row</span>
            <select
              id={`${idPrefix}-row_id`}
              name="row_id"
              defaultValue={defaultRowId ?? ""}
              className={FIELD}
            >
              <option value="">— none —</option>
              {selected.rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Section</span>
            <input
              id={`${idPrefix}-section`}
              name="section"
              type="text"
              defaultValue={defaultSection ?? ""}
              placeholder="e.g. 3"
              className={FIELD}
            />
          </label>
        </>
      )}
    </div>
  );
}
