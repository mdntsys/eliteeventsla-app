"use client";

import { useActionState, useState } from "react";
import {
  addInventoryUnit,
  updateInventoryUnit,
  deleteInventoryUnit,
} from "@/lib/inventory/actions";
import type {
  ActionState,
  InventoryItemDetail,
  InventoryUnitView,
} from "@/lib/inventory/types";
import type { LocationOption } from "@/lib/locations/types";
import { StatusBadge } from "@/components/inventory/status-badge";
import { LocationFields } from "@/components/inventory/location-fields";
import { ImageUpload } from "@/components/shared/image-upload";

const UNIT_STATUSES = [
  "available",
  "reserved",
  "in_use",
  "maintenance",
  "retired",
] as const;

const inputClass =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function formatUnitLocation(unit: InventoryUnitView): string {
  if (!unit.location_name) return "No location set";
  const parts = [unit.location_name];
  if (unit.row_label) parts.push(`Row ${unit.row_label}`);
  if (unit.section) parts.push(`Section ${unit.section}`);
  return parts.join(" · ");
}

/**
 * Full edit form for a single serialized unit: asset tag, serial number,
 * status, condition notes, and storage location in one save.
 */
function UnitEditForm({
  unit,
  itemId,
  options,
}: {
  unit: InventoryUnitView;
  itemId: string;
  options: LocationOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateInventoryUnit,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="unit_id" value={unit.id} />
      <input type="hidden" name="item_id" value={itemId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Asset tag</span>
          <input
            name="asset_tag"
            type="text"
            defaultValue={unit.asset_tag ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Serial number</span>
          <input
            name="serial_number"
            type="text"
            defaultValue={unit.serial_number ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Status</span>
          <select
            name="status"
            defaultValue={unit.status}
            className={inputClass}
          >
            {UNIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Condition notes</span>
          <input
            name="condition_notes"
            type="text"
            defaultValue={unit.condition_notes ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <LocationFields
        options={options}
        defaultLocationId={unit.location_id}
        defaultRowId={unit.row_id}
        defaultSection={unit.section}
        idPrefix={`unit-${unit.id}`}
      />

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700">Unit updated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save unit"}
      </button>
    </form>
  );
}

/**
 * Mistake-safe delete for a single unit. The server action blocks the delete
 * when the unit has event or maintenance history and tells you to retire it
 * instead; a confirm guards a mis-click.
 */
function DeleteUnitButton({
  unit,
  itemId,
}: {
  unit: InventoryUnitView;
  itemId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteInventoryUnit,
    undefined,
  );

  const label = unit.asset_tag ?? "this unit";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete “${label}”? Only do this for a unit entered by mistake — this can't be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-start gap-1"
    >
      <input type="hidden" name="unit_id" value={unit.id} />
      <input type="hidden" name="item_id" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete unit"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function UnitRow({
  unit,
  itemId,
  options,
}: {
  unit: InventoryUnitView;
  itemId: string;
  options: LocationOption[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="bg-cream px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="w-16 shrink-0">
            <ImageUpload
              kind="unit"
              targetId={unit.id}
              itemId={itemId}
              currentUrl={unit.image_url}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {unit.asset_tag ?? "Untagged"}
            </p>
            <p className="truncate text-xs text-muted">
              {unit.serial_number
                ? `S/N ${unit.serial_number}`
                : "No serial number"}
              {unit.condition_notes ? ` · ${unit.condition_notes}` : ""}
            </p>
            <p className="mt-1 truncate text-xs text-muted">
              {formatUnitLocation(unit)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={unit.status} />
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-muted underline-offset-2 transition hover:text-navy hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-4 border-t border-line pt-3">
          <UnitEditForm unit={unit} itemId={itemId} options={options} />
          <div className="border-t border-line pt-3">
            <DeleteUnitButton unit={unit} itemId={itemId} />
          </div>
        </div>
      )}
    </li>
  );
}

export function UnitsPanel({
  item,
  locationOptions,
}: {
  item: InventoryItemDetail;
  locationOptions: LocationOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addInventoryUnit,
    undefined,
  );

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Units</h2>
        <span className="eyebrow">{item.units.length} tracked</span>
      </div>

      {item.units.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No units yet. Add the first serialized unit below.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {item.units.map((unit) => (
            <UnitRow
              key={unit.id}
              unit={unit}
              itemId={item.id}
              options={locationOptions}
            />
          ))}
        </ul>
      )}

      <form action={action} className="mt-6 border-t border-line pt-6">
        <input type="hidden" name="item_id" value={item.id} />
        <p className="eyebrow mb-3">Add unit</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Asset tag</span>
            <input name="asset_tag" type="text" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Serial number</span>
            <input name="serial_number" type="text" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Status</span>
            <select name="status" defaultValue="available" className={inputClass}>
              {UNIT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Condition notes</span>
            <input name="condition_notes" type="text" className={inputClass} />
          </label>
        </div>

        <div className="mt-3">
          <LocationFields options={locationOptions} idPrefix="add-unit" />
        </div>

        {state?.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-3 text-sm text-green-700">Unit added.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add unit"}
        </button>
      </form>
    </section>
  );
}
