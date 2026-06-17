"use client";

import { useActionState } from "react";
import { logMaintenance, resolveMaintenance } from "@/lib/inventory/actions";
import type {
  ActionState,
  InventoryItemDetail,
  MaintenanceRecord,
} from "@/lib/inventory/types";
import { StatusBadge } from "@/components/inventory/status-badge";

const MAINTENANCE_STATUSES = ["open", "in_progress", "resolved"] as const;

const inputClass =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function formatCost(cost: number | null): string | null {
  if (cost == null) return null;
  return cost.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ResolveButton({
  record,
  itemId,
}: {
  record: MaintenanceRecord;
  itemId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resolveMaintenance,
    undefined,
  );

  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="item_id" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
      >
        {pending ? "Resolving…" : "Resolve"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function MaintenancePanel({ item }: { item: InventoryItemDetail }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    logMaintenance,
    undefined,
  );

  const openCount = item.maintenance.filter(
    (m) => m.status !== "resolved",
  ).length;

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">
          Maintenance
        </h2>
        <span className="eyebrow">{openCount} open</span>
      </div>

      {item.maintenance.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No maintenance records. Log an issue below.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {item.maintenance.map((record) => {
            const cost = formatCost(record.cost);
            return (
              <li
                key={record.id}
                className="flex items-start justify-between gap-4 bg-cream px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{record.issue}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(record.reported_at)}
                    {cost ? ` · ${cost}` : ""}
                    {record.unit_id ? " · unit" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={record.status} />
                  {record.status !== "resolved" && (
                    <ResolveButton record={record} itemId={item.id} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={action} className="mt-6 border-t border-line pt-6">
        <input type="hidden" name="item_id" value={item.id} />
        <p className="eyebrow mb-3">Log maintenance</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs text-muted">Issue</span>
            <input name="issue" type="text" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Cost</span>
            <input
              name="cost"
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Status</span>
            <select name="status" defaultValue="open" className={inputClass}>
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state?.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-3 text-sm text-green-700">Maintenance logged.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log maintenance"}
        </button>
      </form>
    </section>
  );
}
