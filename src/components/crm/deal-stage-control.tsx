"use client";

import { useActionState } from "react";
import { setDealStage, convertDealToEvent } from "@/lib/crm/actions";
import type { ActionState, Option } from "@/lib/crm/types";

/**
 * Inline stage control for a deal detail page plus the "Convert to event"
 * action. Changing the stage select submits setDealStage, which also reconciles
 * status (won/lost/open) from the stage flags and revalidates. Converting
 * submits convertDealToEvent, which inserts an event and redirects to it. Both
 * are bound via useActionState, matching the servicing TicketControls pattern.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-navy disabled:opacity-60";

export function DealStageControl({
  dealId,
  stageId,
  stages,
}: {
  dealId: string;
  stageId: string | null;
  stages: Option[];
}) {
  const [stageState, stageAction, stagePending] = useActionState<
    ActionState,
    FormData
  >(setDealStage, undefined);
  const [convertState, convertAction, convertPending] = useActionState<
    ActionState,
    FormData
  >(convertDealToEvent, undefined);

  function submitStage(e: React.ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form action={stageAction} className="flex flex-col gap-1">
        <input type="hidden" name="deal_id" value={dealId} />
        <span className="text-[11px] uppercase tracking-wide text-muted">
          Stage
        </span>
        <select
          name="stage_id"
          defaultValue={stageId ?? ""}
          disabled={stagePending || convertPending}
          onChange={submitStage}
          className={FIELD}
        >
          {stageId == null && (
            <option value="" disabled>
              Unstaged
            </option>
          )}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </form>

      <form action={convertAction}>
        <input type="hidden" name="deal_id" value={dealId} />
        <button
          type="submit"
          disabled={stagePending || convertPending}
          className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {convertPending ? "Converting…" : "Convert to event"}
        </button>
      </form>

      {(stageState?.error || convertState?.error) && (
        <p role="alert" className="w-full text-xs text-red-700">
          {stageState?.error ?? convertState?.error}
        </p>
      )}
    </div>
  );
}
