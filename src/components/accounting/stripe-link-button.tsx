"use client";

import { useActionState } from "react";
import {
  createStripePaymentLink,
  emailStripePaymentLink,
} from "@/lib/accounting/actions";
import type { ActionState } from "@/lib/accounting/types";

/**
 * Collect-payment actions for an invoice: create a Stripe payment link (shows
 * the URL to copy/send by hand) or email that link straight to the client (to
 * the linked contact's email, falling back to the company's). If
 * STRIPE_SECRET_KEY is absent both degrade to a calm "Connect Stripe" hint
 * rather than an error, so the rest of accounting keeps working.
 */
export function StripeLinkButton({ invoiceId }: { invoiceId: string }) {
  const [genState, genAction, genPending] = useActionState<
    ActionState,
    FormData
  >(createStripePaymentLink, undefined);
  const [emailState, emailAction, emailPending] = useActionState<
    ActionState,
    FormData
  >(emailStripePaymentLink, undefined);

  const url = emailState?.url ?? genState?.url;
  const unconfigured =
    genState?.stripeUnconfigured || emailState?.stripeUnconfigured;

  return (
    <div className="flex flex-col gap-3">
      <form action={emailAction}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          type="submit"
          disabled={emailPending}
          className="w-full rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {emailPending ? "Emailing client…" : "Email payment link to client"}
        </button>
      </form>

      <form action={genAction}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          type="submit"
          disabled={genPending}
          className="w-full rounded-(--radius-card) border border-line px-4 py-2.5 text-sm font-medium text-navy transition hover:border-navy disabled:opacity-60"
        >
          {genPending ? "Creating link…" : "Create link to copy"}
        </button>
      </form>

      {emailState?.success && emailState.emailedTo && (
        <p className="text-xs text-green-700">
          ✓ Payment link emailed to {emailState.emailedTo}.
        </p>
      )}

      {url && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <span className="eyebrow">Payment link</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-navy underline underline-offset-2"
          >
            {url}
          </a>
        </div>
      )}

      {unconfigured ? (
        <p className="text-xs text-muted">
          Stripe isn’t connected yet. Add <code>STRIPE_SECRET_KEY</code> to
          enable payment links.
        </p>
      ) : (
        <>
          {genState?.error && (
            <p role="alert" className="text-xs text-red-700">
              {genState.error}
            </p>
          )}
          {emailState?.error && (
            <p role="alert" className="text-xs text-red-700">
              {emailState.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
