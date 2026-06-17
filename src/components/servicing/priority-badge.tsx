import type { ReactNode } from "react";

/**
 * Priority pill for service tickets. Server component (no interactivity).
 * Colored by urgency: low (muted), medium (navy), high (amber), urgent (red).
 */

const PRIORITY_STYLES: Record<string, string> = {
  low: "border-line bg-cream text-muted",
  medium: "border-line bg-cream-deep text-navy",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const className =
    PRIORITY_STYLES[priority] ?? "border-line bg-cream text-muted";
  const label = PRIORITY_LABELS[priority] ?? priority.replace(/_/g, " ");
  return <Pill className={className}>{label}</Pill>;
}
