"use client";

import { useActionState } from "react";
import {
  updateAffiliateTax,
  uploadW9,
  removeW9,
} from "@/lib/affiliates/actions";
import type { ActionState, AffiliateTaxInfo } from "@/lib/affiliates/types";

/**
 * SUPER-ADMIN-ONLY tax & compliance panel for an affiliate: the EIN and the
 * completed IRS Form W-9. Both live in the isolated affiliate_private store /
 * private affiliate-tax bucket and are never exposed to the portal or staff below
 * super-admin. The W-9 is required by the commission agreement before any payout,
 * and the payout action hard-blocks until it's on file.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function EinForm({
  affiliateId,
  ein,
}: {
  affiliateId: string;
  ein: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAffiliateTax,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="affiliate_id" value={affiliateId} />
      <span className="text-xs text-muted">EIN (tax ID)</span>
      <div className="flex items-center gap-2">
        <input
          name="ein"
          type="text"
          defaultValue={ein ?? ""}
          placeholder="12-3456789"
          className={`${FIELD} flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) border border-line px-3.5 py-2.5 text-sm text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && <p className="text-xs text-emerald-700">Saved.</p>}
    </form>
  );
}

function W9Upload({ affiliateId }: { affiliateId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadW9,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="affiliate_id" value={affiliateId} />
      <span className="text-xs text-muted">Upload W-9 (PDF, PNG, or JPEG)</span>
      <input
        name="w9"
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        required
        className="text-sm text-ink file:mr-3 file:rounded-(--radius-card) file:border-0 file:bg-navy file:px-3 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:opacity-90"
      />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Save W-9"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function W9Remove({ affiliateId }: { affiliateId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeW9,
    undefined,
  );
  return (
    <form action={action}>
      <input type="hidden" name="affiliate_id" value={affiliateId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-muted transition hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function AffiliateTaxPanel({
  affiliateId,
  taxInfo,
}: {
  affiliateId: string;
  taxInfo: AffiliateTaxInfo;
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-xl font-light text-navy">
          Tax &amp; compliance
        </h2>
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">
          Super-admin only
        </span>
      </div>
      <p className="mb-5 max-w-prose text-sm text-muted">
        EIN and W-9 are isolated and never shown in the portal or to other staff.
        A W-9 is required before any payout.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <EinForm affiliateId={affiliateId} ein={taxInfo.ein} />

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">W-9 on file</span>
          {taxInfo.w9OnFile ? (
            <div className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {taxInfo.w9Filename ?? "W-9 document"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Uploaded {formatDate(taxInfo.w9UploadedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {taxInfo.w9Url && (
                    <a
                      href={taxInfo.w9Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  )}
                  <W9Remove affiliateId={affiliateId} />
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-(--radius-card) border border-dashed border-amber-300 bg-amber-50/60 px-3.5 py-2.5 text-sm text-amber-800">
              No W-9 on file — payouts are blocked until one is added.
            </p>
          )}
          <div className="mt-1">
            <W9Upload affiliateId={affiliateId} />
          </div>
        </div>
      </div>
    </section>
  );
}
