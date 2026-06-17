"use client";

import { useActionState, useRef } from "react";
import { uploadReturnProof } from "@/lib/events/actions";
import type { ActionState } from "@/lib/events/types";

/**
 * Photo-proof uploader. A real multipart file input bound to the
 * uploadReturnProof server action via useActionState. The hidden event_id /
 * event_item_id scope the attachment; a plain <form action={action}> with an
 * <input type="file"> posts as multipart so the File survives to the action.
 */
export function ProofUpload({
  eventId,
  eventItemId,
  kind = "return_proof",
}: {
  eventId: string;
  eventItemId?: string;
  kind?: "return_proof" | "delivery_proof" | "other";
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadReturnProof,
    undefined,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={action}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="kind" value={kind} />
      {eventItemId && (
        <input type="hidden" name="event_item_id" value={eventItemId} />
      )}
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept="image/*"
        required
        className="block max-w-full text-xs text-muted file:mr-3 file:rounded-(--radius-card) file:border file:border-line file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy file:transition hover:file:border-navy"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload proof"}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="w-full text-xs text-green-700">Proof uploaded.</p>
      )}
    </form>
  );
}
