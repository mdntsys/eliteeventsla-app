import type { ReactNode } from "react";
import type { QuoteStatus } from "@/lib/quotes/types";

/** Status pill for quotes (server component). */
function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const STYLES: Record<QuoteStatus, string> = {
  draft: "border-line bg-cream-deep text-muted",
  sent: "border-line bg-cream-deep text-navy",
  accepted: "border-green-200 bg-green-50 text-green-700",
  declined: "border-red-200 bg-red-50 text-red-700",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
  converted: "border-green-200 bg-green-50 text-green-700",
};

const LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Pill className={STYLES[status]}>{LABELS[status]}</Pill>;
}
