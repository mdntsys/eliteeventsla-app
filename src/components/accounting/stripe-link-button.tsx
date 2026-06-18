"use client";

import { useActionState } from "react";
import { createStripePaymentLink } from "@/lib/accounting/actions";
import type { ActionState } from "@/lib/accounting/types";

/**
 * Creates a Stripe payment link for an invoice. If STRIPE_SECRET_KEY is absent
 * the action returns { stripeUnconfigured }, and we render a calm "Connect
 * Stripe" hint instead of an error — the rest of accounting still works.
 */
export function StripeLinkButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createStripePaymentLink,
    undefined,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) border border-line px-4 py-2 text-sm font-medium text-navy transition hover:border-navy disabled:opacity-60"
        >
          {pending ? "Creating link…" : "Create Stripe payment link"}
        </button>
      </form>

      {state?.url && (
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-navy underline underline-offset-2"
        >
          {state.url}
        </a>
      )}

      {state?.stripeUnconfigured ? (
        <p className="text-xs text-muted">
          Stripe isn’t connected yet. Add <code>STRIPE_SECRET_KEY</code> to enable
          one-click payment links.
        </p>
      ) : (
        state?.error && (
          <p role="alert" className="text-xs text-red-700">
            {state.error}
          </p>
        )
      )}
    </div>
  );
}
