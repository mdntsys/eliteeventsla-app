"use client";

import { useActionState } from "react";
import { sendDocument, voidDocument } from "@/lib/documents/actions";
import type { ActionState } from "@/lib/documents/types";

/**
 * Staff-side actions for a document: send it for signature (mints/refreshes a
 * signing link — the resulting link comes back in the action's notice) and void
 * it. A signed or voided document can no longer be sent; a signed document can't
 * be voided. Voiding asks for confirmation first — it can't be undone.
 */
export function DocumentActions({
  documentId,
  status,
}: {
  documentId: string;
  status: string;
}) {
  const [sendState, sendAction, sendPending] = useActionState<
    ActionState,
    FormData
  >(sendDocument, undefined);
  const [voidState, voidAction, voidPending] = useActionState<
    ActionState,
    FormData
  >(voidDocument, undefined);

  const canSend = status !== "signed" && status !== "voided";
  const canVoid = status !== "signed";

  const btn =
    "inline-flex items-center justify-center rounded-(--radius-card) px-4 py-2 text-sm font-medium transition disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canSend && (
          <form action={sendAction}>
            <input type="hidden" name="id" value={documentId} />
            <button
              type="submit"
              disabled={sendPending}
              className={`${btn} bg-navy text-cream hover:opacity-90`}
            >
              {sendPending ? "Sending…" : "Send for signature"}
            </button>
          </form>
        )}

        {canVoid && (
          <form
            action={voidAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  "Void this document? It can no longer be signed.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={documentId} />
            <button
              type="submit"
              disabled={voidPending}
              className={`${btn} border border-line text-muted hover:text-navy`}
            >
              {voidPending ? "Voiding…" : "Void"}
            </button>
          </form>
        )}
      </div>

      {sendState?.error && (
        <p role="alert" className="text-sm text-red-700">
          {sendState.error}
        </p>
      )}
      {sendState?.notice && (
        <p className="text-sm text-muted">{sendState.notice}</p>
      )}
      {voidState?.error && (
        <p role="alert" className="text-sm text-red-700">
          {voidState.error}
        </p>
      )}
      {voidState?.notice && (
        <p className="text-sm text-muted">{voidState.notice}</p>
      )}
    </div>
  );
}
