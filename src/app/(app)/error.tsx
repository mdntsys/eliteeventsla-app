"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Error boundary for authenticated routes. Catches anything thrown while
 * rendering a page (e.g. a query's `throw new Error(...)`) and shows a branded,
 * recoverable surface inside AppChrome instead of leaking the raw error to
 * Next's default overlay. `reset()` re-renders the segment to retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface details to the browser console / error reporting; the operator
    // only sees the friendly copy below.
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader
        eyebrow="Something went wrong"
        title="We hit a snag loading this"
        description="The page couldn't load. This is usually temporary — try again, or head back and retry."
      />

      <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-8">
        <p className="max-w-2xl text-sm text-muted">
          If it keeps happening, contact an administrator
          {error.digest ? (
            <>
              {" "}
              and share this reference:{" "}
              <code className="rounded bg-cream-deep px-1.5 py-0.5 text-xs text-ink">
                {error.digest}
              </code>
            </>
          ) : (
            "."
          )}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm text-cream transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
