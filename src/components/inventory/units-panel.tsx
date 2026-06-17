"use client";

import { useActionState } from "react";
import { addInventoryUnit } from "@/lib/inventory/actions";
import type { ActionState, InventoryItemDetail } from "@/lib/inventory/types";
import { StatusBadge } from "@/components/inventory/status-badge";

const UNIT_STATUSES = [
  "available",
  "reserved",
  "in_use",
  "maintenance",
  "retired",
] as const;

const inputClass =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function UnitsPanel({ item }: { item: InventoryItemDetail }) {
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
            <li
              key={unit.id}
              className="flex items-center justify-between gap-4 bg-cream px-4 py-3"
            >
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
              </div>
              <StatusBadge status={unit.status} />
            </li>
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
