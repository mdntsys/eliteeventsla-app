"use client";

import { useActionState } from "react";
import { convertQuote } from "@/lib/quotes/actions";
import type { ActionState } from "@/lib/quotes/types";

/**
 * Realizes an accepted quote: convertQuote creates an event + draft invoice and
 * redirects to the event on success. Shown once a quote is accepted (and not
 * already converted). Hidden in print.
 */
export function ConvertQuoteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    convertQuote,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2 print:hidden">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Converting…" : "Convert to event + invoice"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
