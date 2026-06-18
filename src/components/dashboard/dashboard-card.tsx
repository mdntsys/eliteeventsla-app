import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Generic ops-dashboard widget shell. Matches the shipped module surfaces:
 * rounded card, hairline border, cream-card fill. An eyebrow + display heading,
 * an optional "View all →" deep link, and a flexible body (usually a list).
 */
export function DashboardCard({
  title,
  href,
  viewAllLabel = "View all",
  count,
  children,
}: {
  title: string;
  href?: string;
  viewAllLabel?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-(--radius-card) border border-line bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-light text-navy">{title}</h2>
          {typeof count === "number" && count > 0 && (
            <span className="text-xs text-muted tabular-nums">{count}</span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="eyebrow shrink-0 text-muted underline-offset-2 transition hover:text-navy"
          >
            {viewAllLabel} →
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

/** Consistent empty state used inside the widget cards. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/** A single list row. Optional href wraps the whole row in a hover-able link. */
export function ListRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0 first:pt-0">
      {children}
    </div>
  );
}
