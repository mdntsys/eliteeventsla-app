"use client";

import { useActionState, useState } from "react";
import {
  createLocation,
  updateLocation,
  deleteLocation,
  addWarehouseRow,
  removeWarehouseRow,
} from "@/lib/locations/actions";
import type { ActionState, LocationWithRows } from "@/lib/locations/types";

/**
 * Locations admin. Lists each location (name, kind, notes, active) with inline
 * edit + delete. Warehouse locations also manage their rows (remove + add). A
 * "New location" form sits at the top. Every form binds to its own server
 * action via useActionState so submits/errors stay isolated per location/row.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function KindBadge({ kind }: { kind: "warehouse" | "offsite" }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
      {kind === "warehouse" ? "Warehouse" : "Offsite"}
    </span>
  );
}

export function LocationsManager({
  locations,
}: {
  locations: LocationWithRows[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <NewLocationForm />

      {locations.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
          <p className="eyebrow">No locations yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add a warehouse or an offsite spot to start assigning where
            equipment lives.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {locations.map((location) => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewLocationForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createLocation,
    undefined,
  );

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90"
        >
          New location
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">New</p>
          <h2 className="font-display mt-0.5 text-xl font-light text-navy">
            Add location
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm text-muted transition hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <form action={action} className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Name</span>
          <input name="name" type="text" required className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Kind</span>
          <select name="kind" defaultValue="warehouse" className={FIELD}>
            <option value="warehouse">Warehouse</option>
            <option value="offsite">Offsite</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="eyebrow">Notes</span>
          <textarea name="notes" rows={2} className={FIELD} />
        </label>

        {state?.error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save location"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function LocationCard({ location }: { location: LocationWithRows }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      {editing ? (
        <EditLocationForm
          location={location}
          onClose={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-lg font-light text-navy">
                {location.name}
              </h3>
              <KindBadge kind={location.kind} />
              {!location.is_active && (
                <span className="inline-flex items-center rounded-full border border-line bg-cream-deep px-2.5 py-0.5 text-xs font-medium text-muted">
                  Inactive
                </span>
              )}
            </div>
            {location.notes && (
              <p className="mt-2 max-w-2xl text-sm text-muted">
                {location.notes}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm text-muted transition hover:text-ink"
            >
              Edit
            </button>
            <DeleteLocationButton id={location.id} />
          </div>
        </div>
      )}

      {location.kind === "warehouse" && (
        <RowsManager location={location} />
      )}
    </div>
  );
}

function EditLocationForm({
  location,
  onClose,
}: {
  location: LocationWithRows;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateLocation,
    undefined,
  );

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={location.id} />

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Name</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={location.name}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="eyebrow">Kind</span>
        <select name="kind" defaultValue={location.kind} className={FIELD}>
          <option value="warehouse">Warehouse</option>
          <option value="offsite">Offsite</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="eyebrow">Notes</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={location.notes ?? ""}
          className={FIELD}
        />
      </label>

      <label className="flex items-center gap-2.5 sm:col-span-2">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={location.is_active}
          className="h-4 w-4 rounded border-line text-navy focus:ring-navy"
        />
        <span className="text-sm text-ink">Active</span>
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteLocationButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteLocation,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Delete"}
      </button>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function RowsManager({ location }: { location: LocationWithRows }) {
  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="eyebrow mb-3">Rows</p>

      {location.rows.length === 0 ? (
        <p className="text-sm text-muted">No rows yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {location.rows.map((row) => (
            <RowChip key={row.id} id={row.id} label={row.label} />
          ))}
        </div>
      )}

      <AddRowForm locationId={location.id} />
    </div>
  );
}

function RowChip({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeWarehouseRow,
    undefined,
  );

  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-2.5 py-1 text-xs font-medium text-ink">
        {label}
        <button
          type="submit"
          disabled={pending}
          aria-label={`Remove ${label}`}
          className="text-muted transition hover:text-red-700 disabled:opacity-60"
        >
          ×
        </button>
      </span>
      {state?.error && (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}

function AddRowForm({ locationId }: { locationId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addWarehouseRow,
    undefined,
  );

  return (
    <form action={action} className="mt-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <input type="hidden" name="location_id" value={locationId} />
        <input
          name="label"
          type="text"
          required
          placeholder="Row label (e.g. Row D)"
          className={`${FIELD} flex-1 py-2 text-sm sm:max-w-xs`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add row"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
