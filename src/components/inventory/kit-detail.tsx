"use client";

import { useActionState, useState } from "react";
import {
  updateKit,
  deleteKit,
  addKitLine,
  updateKitLine,
  removeKitLine,
} from "@/lib/inventory/kit-actions";
import type { KitDetail, KitLine } from "@/lib/inventory/kit-types";
import type { ActionState } from "@/lib/inventory/types";
import type { InventoryListRow } from "@/lib/inventory/types";
import type { LocationOption } from "@/lib/locations/types";
import { LocationFields } from "@/components/inventory/location-fields";

/**
 * One bundle: its name/location settings and its contents.
 *
 * Contents are (item, quantity) lines rather than one row per physical thing —
 * that's what lets a 20-count box of props split 10/10 across two pallets. A
 * serialized item can instead be pinned to a specific unit, so Photo Booth A
 * always carries its own machine.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function LineRow({
  line,
  kitId,
  canEdit,
}: {
  line: KitLine;
  kitId: string;
  canEdit: boolean;
}) {
  const [qtyState, qtyAction, qtyPending] = useActionState<
    ActionState,
    FormData
  >(updateKitLine, undefined);
  const [delState, delAction, delPending] = useActionState<
    ActionState,
    FormData
  >(removeKitLine, undefined);

  const error = qtyState?.error ?? delState?.error;
  // A bundle asking for more than exists on hand is a packing mistake worth
  // flagging here rather than at reservation time.
  const overcommitted = !line.unit_id && line.quantity > line.item_on_hand;

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{line.item_name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[
            line.item_sku,
            line.unit_asset_tag ? `Unit ${line.unit_asset_tag}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {line.unit_id ? (
          <span className="text-sm text-muted">1 (pinned unit)</span>
        ) : canEdit ? (
          <form action={qtyAction} className="flex items-center justify-end gap-2">
            <input type="hidden" name="id" value={line.id} />
            <input type="hidden" name="kit_id" value={kitId} />
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={line.quantity}
              className="w-20 rounded-(--radius-card) border border-line bg-cream px-2 py-1 text-right text-sm text-ink outline-none focus:border-navy"
            />
            <button
              type="submit"
              disabled={qtyPending}
              className="rounded-(--radius-card) border border-line px-2.5 py-1 text-xs text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
            >
              {qtyPending ? "…" : "Save"}
            </button>
          </form>
        ) : (
          <span className="text-sm text-ink tabular-nums">{line.quantity}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        <span className={overcommitted ? "text-red-700" : "text-muted"}>
          {line.item_on_hand}
        </span>
        {overcommitted && (
          <p className="text-xs text-red-700">more than on hand</p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canEdit && (
          <form action={delAction}>
            <input type="hidden" name="id" value={line.id} />
            <input type="hidden" name="kit_id" value={kitId} />
            <button
              type="submit"
              disabled={delPending}
              className="text-xs text-muted underline-offset-2 transition hover:text-red-700 hover:underline disabled:opacity-60"
            >
              {delPending ? "Removing…" : "Remove"}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}

function AddLineForm({
  kitId,
  items,
}: {
  kitId: string;
  items: InventoryListRow[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addKitLine,
    undefined,
  );
  const [itemId, setItemId] = useState("");

  const selected = items.find((i) => i.id === itemId) ?? null;
  const unitOptions = selected?.available_unit_options ?? [];
  const isSerialized = selected?.kind === "serialized";

  return (
    <form
      action={action}
      className="rounded-(--radius-card) border border-line bg-card p-5"
    >
      <p className="eyebrow mb-4">Add an item</p>
      <input type="hidden" name="kit_id" value={kitId} />

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Item</span>
          <select
            name="item_id"
            required
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">— pick an item —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.sku ? ` (${item.sku})` : ""} — {item.quantity} on hand
              </option>
            ))}
          </select>
        </label>

        {isSerialized ? (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Unit</span>
            <select name="unit_id" className={FIELD}>
              <option value="">Any available</option>
              {unitOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.asset_tag ?? u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Quantity</span>
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              className={FIELD}
            />
          </label>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function KitSettings({
  kit,
  locationOptions,
}: {
  kit: KitDetail;
  locationOptions: LocationOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateKit,
    undefined,
  );
  const [delState, delAction, delPending] = useActionState<
    ActionState,
    FormData
  >(deleteKit, undefined);

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <p className="eyebrow mb-4">Bundle settings</p>
      <form action={action}>
        <input type="hidden" name="id" value={kit.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Name</span>
            <input
              name="name"
              required
              defaultValue={kit.name}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Description</span>
            <input
              name="description"
              defaultValue={kit.description ?? ""}
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs text-muted">
            Where this pallet sits — what a crew member is told to walk to.
          </p>
          <LocationFields
            options={locationOptions}
            defaultLocationId={kit.location_id}
            defaultRowId={kit.row_id}
            defaultSection={kit.section}
            idPrefix={`kit-${kit.id}`}
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={kit.is_active}
            className="h-4 w-4 rounded border-line accent-navy"
          />
          <span>
            Active — offer this bundle when reserving gear for a job
          </span>
        </label>

        {state?.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="mt-3 text-sm text-green-700">Saved.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save bundle"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <p className="mb-3 text-xs text-muted">
          Deleting a bundle only removes the grouping. No inventory is changed
          and reservations already made from it stay put.
        </p>
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!window.confirm(`Delete the bundle “${kit.name}”?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={kit.id} />
          <button
            type="submit"
            disabled={delPending}
            className="rounded-(--radius-card) border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-700 disabled:opacity-60"
          >
            {delPending ? "Deleting…" : "Delete bundle"}
          </button>
          {delState?.error && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {delState.error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

export function KitDetailView({
  kit,
  items,
  locationOptions,
  canEdit,
}: {
  kit: KitDetail;
  items: InventoryListRow[];
  locationOptions: LocationOption[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-(--radius-card) border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-light text-navy">
            What&rsquo;s on this pallet
          </h2>
          <span className="text-sm text-muted">
            {kit.lines.length} {kit.lines.length === 1 ? "item" : "items"} ·{" "}
            {kit.piece_count} pieces
          </span>
        </div>

        {kit.lines.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            Nothing in this bundle yet. Add items below, or select several on the
            inventory list and assign them here in one go.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Item</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    In bundle
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    On hand
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {kit.lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    kitId={kit.id}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit && <AddLineForm kitId={kit.id} items={items} />}
      {canEdit && <KitSettings kit={kit} locationOptions={locationOptions} />}
    </div>
  );
}
