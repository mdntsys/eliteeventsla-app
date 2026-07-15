"use client";

import { useActionState } from "react";
import Link from "next/link";
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
  continueHref,
  completeHref,
  requireMediaRelease = false,
}: {
  token: string;
  signerName: string | null;
  /** When set (the affiliate portal), show a link into the app after signing. */
  continueHref?: string;
  /**
   * Public token flows: the server redirects here after signing so the signer
   * sees a thank-you page instead of a consumed-token 404. Omit in the portal,
   * which shows the inline success state + continue link.
   */
  completeHref?: string;
  /** SOWs (#5): the client must elect Yes/No for the media release to sign. */
  requireMediaRelease?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    signDocument,
    undefined,
  );

  if (state?.success) {
    return (
      <div className="mt-8 rounded-(--radius-card) border border-green-300 bg-green-50 px-4 py-4 text-sm text-green-800">
        <p>✓ Signed — thank you. A copy has been recorded.</p>
        {continueHref && (
          <Link
            href={continueHref}
            className="mt-3 inline-block rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
          >
            Continue to your portal →
          </Link>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 border-t border-line pt-6">
      <input type="hidden" name="token" value={token} />
      {completeHref && (
        <input type="hidden" name="complete_href" value={completeHref} />
      )}

      {requireMediaRelease && (
        <fieldset className="mb-6">
          <legend className="eyebrow">Media release — please choose one</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="media_release"
                value="yes"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
              />
              <span>
                <strong>YES</strong> — I agree to the media release terms.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="media_release"
                value="no"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
              />
              <span>
                <strong>NO</strong> — I do not agree. Keep our media private.
              </span>
            </label>
          </div>
        </fieldset>
      )}

      <p className="eyebrow">Adopt &amp; Sign</p>

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
