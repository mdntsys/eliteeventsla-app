import type { ReactNode } from "react";

/**
 * Small status pill. Server component (no client interactivity). Covers the
 * union of item_status, unit_status, and maintenance_status values, plus a
 * sensible default for anything unmapped.
 */

const STATUS_STYLES: Record<string, string> = {
  // available — the "good" resting state
  available: "border-line bg-cream-deep text-navy",
  // in-flight / committed — neutral/muted
  in_use: "border-line bg-cream-deep text-muted",
  reserved: "border-line bg-cream-deep text-muted",
  // attention needed — amber
  maintenance: "border-amber-200 bg-amber-50 text-amber-700",
  open: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  // terminal states
  retired: "border-line bg-cream-deep text-muted",
  resolved: "border-green-200 bg-green-50 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_use: "In use",
  reserved: "Reserved",
  maintenance: "Maintenance",
  open: "Open",
  in_progress: "In progress",
  retired: "Retired",
  resolved: "Resolved",
};

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const className = STATUS_STYLES[status] ?? "border-line bg-cream-deep text-muted";
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return <Pill className={className}>{label}</Pill>;
}

export function KindBadge({ kind }: { kind: string }) {
  const label = kind === "serialized" ? "Serialized" : "Bulk";
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
      {label}
    </span>
  );
}
