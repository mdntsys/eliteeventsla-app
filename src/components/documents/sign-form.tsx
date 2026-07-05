"use client";

import { useActionState } from "react";
import { signDocument } from "@/lib/documents/actions";
import type { ActionState } from "@/lib/documents/types";

/**
 * The "Adopt & Sign" panel on the public signing page. The signer types (or
 * confirms) their full name, checks the ESIGN/UETA consent box, and submits —
 * signDocument records the signature, IP, and content hash server-side. On
 * success the inputs are replaced by a confirmation so the page can't be
 * re-submitted.
 */
export function SignForm({
  token,
  signerName,
}: {
  token: string;
  signerName: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    signDocument,
    undefined,
  );

  if (state?.success) {
    return (
      <div className="mt-8 rounded-(--radius-card) border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
        ✓ Signed — thank you. A copy has been recorded.
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 border-t border-line pt-6">
      <p className="eyebrow">Adopt &amp; Sign</p>
      <input type="hidden" name="token" value={token} />

      <div className="mt-3">
        <label
          htmlFor="signature_name"
          className="block text-sm font-medium text-navy"
        >
          Your full name
        </label>
        <input
          id="signature_name"
          name="signature_name"
          type="text"
          required
          defaultValue={signerName ?? ""}
          className="mt-1 w-full rounded-(--radius-card) border border-line bg-card px-3 py-2 text-sm text-ink transition placeholder:text-muted focus:border-navy focus:outline-none"
        />
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-navy"
        />
        <span>
          I agree to sign electronically and that my electronic signature is
          legally binding (ESIGN Act / UETA).
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-(--radius-card) bg-navy px-4 py-3 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Signing…" : "Adopt & Sign"}
      </button>
    </form>
  );
}
