"use client";

import { useActionState, useState } from "react";
import { sendInvoiceToClient } from "@/lib/accounting/actions";
import type { ActionState } from "@/lib/accounting/types";

/**
 * Client-facing invoice actions for the internal invoice page: email the
 * itemized invoice (link + PDF) to the client, copy the shareable invoice link,
 * open the client view, or download the PDF. The client pays by card on the
 * linked page (Stripe Checkout) or via the Zelle/wire/check details shown there.
 */
export function InvoiceShareActions({
  invoiceId,
  shareUrl,
  pdfUrl,
}: {
  invoiceId: string;
  shareUrl: string;
  pdfUrl: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendInvoiceToClient,
    undefined,
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the link is shown below.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={action}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invoice to client"}
        </button>
      </form>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-(--radius-card) border border-line px-3 py-2 text-center text-sm font-medium text-navy transition hover:border-navy"
        >
          Preview
        </a>
        <a
          href={pdfUrl}
          className="rounded-(--radius-card) border border-line px-3 py-2 text-center text-sm font-medium text-navy transition hover:border-navy"
        >
          PDF
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-(--radius-card) border border-line px-3 py-2 text-sm font-medium text-navy transition hover:border-navy"
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>

      <p className="text-xs text-muted">
        Preview opens exactly what the client sees. Sending emails them the link
        + PDF and BCCs your team.
      </p>

      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-xs text-navy underline underline-offset-2"
      >
        {shareUrl}
      </a>

      {state?.success && state.emailedTo && (
        <p className="text-xs text-green-700">
          ✓ Invoice emailed to {state.emailedTo}.
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
