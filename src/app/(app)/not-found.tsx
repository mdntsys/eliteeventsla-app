import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Branded 404 for authenticated routes. Detail pages call `notFound()` for a
 * missing or mistyped id; this renders inside AppChrome so the operator keeps
 * the nav and a clear way back instead of Next's default screen.
 */
export default function AppNotFound() {
  return (
    <>
      <PageHeader
        eyebrow="404"
        title="We couldn't find that"
        description="The page or record you're looking for doesn't exist, was removed, or the link is mistyped."
      />

      <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-8">
        <p className="max-w-2xl text-sm text-muted">
          Check the address, or head back and try again from a list view.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm text-cream transition hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
