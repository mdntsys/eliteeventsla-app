"use client";

import { useState, useTransition } from "react";
import { assignItemsToKit } from "@/lib/inventory/kit-actions";

/**
 * Action bar shown alongside the location bar when inventory rows are selected:
 * drop the whole batch into a bundle in one go — the fast way to fill a fresh
 * pallet after splitting stock. Items already in the bundle are skipped rather
 * than erroring, so re-running a selection is safe.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-1.5 text-sm text-ink outline-none transition focus:border-navy";

export function BulkKitBar({
  selectedIds,
  kitOptions,
  onAssigned,
}: {
  selectedIds: string[];
  kitOptions: { id: string; label: string }[];
  onAssigned: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kitId, setKitId] = useState("");

  if (kitOptions.length === 0) return null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await assignItemsToKit(undefined, formData);
      if (result?.error) {
        setError(result.error);
        setNotice(null);
      } else if (result?.warning) {
        // Keep the selection so this actually renders — clearing it unmounts
        // the bar and the message would never be seen.
        setError(null);
        setNotice(result.warning);
      } else {
        setError(null);
        setNotice(null);
        setKitId("");
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

      <span className="text-sm text-muted">Add to bundle</span>

      <select
        name="kit_id"
        value={kitId}
        onChange={(e) => setKitId(e.target.value)}
        required
        className={FIELD}
      >
        <option value="">— pick a bundle —</option>
        {kitOptions.map((kit) => (
          <option key={kit.id} value={kit.id}>
            {kit.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-muted">
        <span>Qty each</span>
        <input
          name="quantity"
          type="number"
          min={1}
          step={1}
          defaultValue={1}
          className={`${FIELD} w-20`}
        />
      </label>

      <button
        type="submit"
        disabled={pending || selectedIds.length === 0 || !kitId}
        className="rounded-(--radius-card) border border-navy px-4 py-1.5 text-sm font-medium text-navy transition hover:bg-navy hover:text-cream disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>

      {error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="w-full text-sm text-amber-800">{notice}</p>
      )}
    </form>
  );
}
