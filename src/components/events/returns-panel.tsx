"use client";

import { useActionState } from "react";
import { checkInItem } from "@/lib/events/actions";
import type {
  ActionState,
  AttachmentRow,
  EventDetail,
  EventItemRow,
} from "@/lib/events/types";
import { ProofUpload } from "@/components/events/proof-upload";

/**
 * WAREHOUSE RETURN surface. For each event_item that is checked out but not yet
 * returned, render a check-in form (condition + notes) and a photo-proof
 * uploader. For already-returned items show the recorded condition plus proof
 * thumbnails. Event-level attachments (not tied to a specific line) are shown at
 * the bottom.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const RETURN_CONDITIONS = ["good", "damaged", "lost"] as const;

const CONDITION_STYLES: Record<string, string> = {
  good: "border-green-200 bg-green-50 text-green-700",
  damaged: "border-amber-200 bg-amber-50 text-amber-700",
  lost: "border-red-200 bg-red-50 text-red-700",
};

function ConditionBadge({ condition }: { condition: string }) {
  const className =
    CONDITION_STYLES[condition] ?? "border-line bg-cream-deep text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {condition}
    </span>
  );
}

function Thumbnails({ attachments }: { attachments: AttachmentRow[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((att) =>
        att.signed_url ? (
          <a
            key={att.id}
            href={att.signed_url}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={att.signed_url}
              alt={att.caption ?? "Return proof"}
              className="h-16 w-16 rounded-(--radius-card) border border-line object-cover"
            />
          </a>
        ) : (
          <span
            key={att.id}
            className="flex h-16 w-16 items-center justify-center rounded-(--radius-card) border border-dashed border-line bg-cream text-[10px] text-muted"
          >
            no preview
          </span>
        ),
      )}
    </div>
  );
}

/* ── Check-in form for one outstanding line ──────────────────────────── */

function CheckInForm({
  eventId,
  line,
}: {
  eventId: string;
  line: EventItemRow;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    checkInItem,
    undefined,
  );

  return (
    <li className="rounded-(--radius-card) border border-line bg-cream p-4">
      <p className="text-sm font-medium text-ink">
        {line.item_name}
        {line.unit_asset_tag ? (
          <span className="ml-2 font-mono text-xs text-muted">
            {line.unit_asset_tag}
          </span>
        ) : (
          <span className="ml-2 text-xs text-muted">×{line.quantity}</span>
        )}
      </p>

      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={line.id} />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Return condition</span>
          <select
            name="return_condition"
            defaultValue="good"
            className={FIELD}
          >
            {RETURN_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Return notes</span>
          <input name="return_notes" type="text" className={FIELD} />
        </label>

        {state?.error && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
        >
          {pending ? "Checking in…" : "Check in"}
        </button>
      </form>

      <ProofUpload eventId={eventId} eventItemId={line.id} />
    </li>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────── */

export function ReturnsPanel({ ev }: { ev: EventDetail }) {
  const outstanding = ev.items.filter(
    (line) => line.checked_out_at != null && line.returned_at == null,
  );
  const returned = ev.items.filter((line) => line.returned_at != null);

  // Attachments grouped by line, plus event-level (no event_item_id).
  const attByItem = new Map<string, AttachmentRow[]>();
  const eventLevel: AttachmentRow[] = [];
  for (const att of ev.attachments) {
    if (att.event_item_id) {
      const list = attByItem.get(att.event_item_id) ?? [];
      list.push(att);
      attByItem.set(att.event_item_id, list);
    } else {
      eventLevel.push(att);
    }
  }

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Returns</h2>
        <span className="eyebrow">{outstanding.length} outstanding</span>
      </div>

      {/* Outstanding check-ins */}
      {outstanding.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          Nothing checked out and awaiting return.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {outstanding.map((line) => (
            <CheckInForm key={line.id} eventId={ev.id} line={line} />
          ))}
        </ul>
      )}

      {/* Returned items */}
      {returned.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-3">Returned</p>
          <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
            {returned.map((line) => (
              <li key={line.id} className="bg-cream px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {line.item_name}
                      {line.unit_asset_tag ? (
                        <span className="ml-2 font-mono text-xs text-muted">
                          {line.unit_asset_tag}
                        </span>
                      ) : (
                        <span className="ml-2 text-xs text-muted">
                          ×{line.quantity}
                        </span>
                      )}
                    </p>
                    {line.return_notes && (
                      <p className="mt-0.5 text-xs text-muted">
                        {line.return_notes}
                      </p>
                    )}
                  </div>
                  {line.return_condition && (
                    <ConditionBadge condition={line.return_condition} />
                  )}
                </div>
                <Thumbnails attachments={attByItem.get(line.id) ?? []} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Event-level attachments */}
      {eventLevel.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-3">Event attachments</p>
          <Thumbnails attachments={eventLevel} />
        </div>
      )}

      {/* Event-level proof upload (no specific line) */}
      <div className="mt-6 border-t border-line pt-6">
        <p className="eyebrow mb-1">Add event-level proof</p>
        <ProofUpload eventId={ev.id} />
      </div>
    </section>
  );
}
