"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createKit } from "@/lib/inventory/kit-actions";
import {
  kitLocationLabel,
  type KitListRow,
} from "@/lib/inventory/kit-types";
import type { ActionState } from "@/lib/inventory/types";
import type { LocationOption } from "@/lib/locations/types";
import { LocationFields } from "@/components/inventory/location-fields";

/**
 * The bundles screen: every pallet, what's on it, and where it lives, plus the
 * form to add another. Creating one redirects into its detail page, which is
 * where items get added.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export function KitsManager({
  kits,
  locationOptions,
  canEdit,
}: {
  kits: KitListRow[];
  locationOptions: LocationOption[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createKit,
    undefined,
  );

  // Close on success in the render body — never in an effect (see PATTERNS).
  if (state?.success && open) setOpen(false);

  return (
    <div className="flex flex-col gap-6">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
          >
            {open ? "Cancel" : "New bundle"}
          </button>
        </div>
      )}

      {open && (
        <form
          action={action}
          className="rounded-(--radius-card) border border-line bg-card p-6"
        >
          <p className="eyebrow mb-4">New bundle</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Name</span>
              <input
                name="name"
                required
                placeholder="Photo Booth C"
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Description</span>
              <input
                name="description"
                placeholder="Complete booth pallet"
                className={FIELD}
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs text-muted">
              Where the assembled bundle sits, so whoever pulls it knows which
              pallet to walk to.
            </p>
            <LocationFields options={locationOptions} idPrefix="kit-new" />
          </div>

          {state?.error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create bundle"}
          </button>
        </form>
      )}

      {kits.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No bundles yet. A bundle is a pallet of gear that gets pulled and
          booked as one — like a complete photo booth.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {kits.map((kit) => {
            const where = kitLocationLabel(kit);
            return (
              <Link
                key={kit.id}
                href={`/operations/inventory/kits/${kit.id}`}
                className="flex flex-col rounded-(--radius-card) border border-line bg-card p-5 transition hover:border-navy"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-light text-navy">
                    {kit.name}
                  </p>
                  {!kit.is_active && (
                    <span className="shrink-0 rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs text-muted">
                      Retired
                    </span>
                  )}
                </div>

                {kit.description && (
                  <p className="mt-1 text-sm text-muted">{kit.description}</p>
                )}

                <p className="mt-3 text-sm text-ink">
                  {kit.line_count === 0 ? (
                    <span className="text-muted">Empty — no items yet</span>
                  ) : (
                    <>
                      {kit.line_count}{" "}
                      {kit.line_count === 1 ? "item" : "items"} ·{" "}
                      {kit.piece_count} total pieces
                    </>
                  )}
                </p>

                <p className="mt-1 text-xs text-muted">
                  {where ?? "No location set"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
