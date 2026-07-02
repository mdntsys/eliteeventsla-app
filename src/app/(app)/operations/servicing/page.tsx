import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import {
  listTickets,
  listTicketFormOptions,
} from "@/lib/servicing/queries";
import { listStaff } from "@/lib/events/queries";
import type { TicketFilter, TicketListRow } from "@/lib/servicing/types";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { PriorityBadge } from "@/components/servicing/priority-badge";
import { NewTicketForm } from "@/components/servicing/new-ticket-form";

export const metadata: Metadata = { title: "Servicing" };

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  delivery: "Delivery",
  equipment: "Equipment",
  billing: "Billing",
  change_request: "Change request",
  complaint: "Complaint",
};

const STATUS_PILLS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_PILLS: { value: string; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function formatAge(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) {
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
      {CATEGORY_LABELS[category] ?? category.replace(/_/g, " ")}
    </span>
  );
}

/** Build an href that toggles a single filter key against the active set. */
function filterHref(
  current: TicketFilter,
  key: keyof TicketFilter,
  value: string,
): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v) next[k] = v;
  }
  if (next[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  const qs = new URLSearchParams(next).toString();
  return qs ? `/operations/servicing?${qs}` : "/operations/servicing";
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
      <p className="font-display text-2xl font-light text-navy">{value}</p>
      <p className="eyebrow mt-0.5">{label}</p>
    </div>
  );
}

export default async function ServicingPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    category?: string;
  }>;
}) {
  await requireView("servicing");
  const sp = await searchParams;

  const filter: TicketFilter = {
    status: sp.status,
    priority: sp.priority,
    category: sp.category,
  };

  const [tickets, staff, formOptions] = await Promise.all([
    listTickets(filter),
    listStaff(),
    listTicketFormOptions(),
  ]);

  // Counts over the (filtered) result set for a quick read.
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "in_progress",
  ).length;
  const urgentCount = tickets.filter(
    (t) =>
      t.priority === "urgent" &&
      t.status !== "resolved" &&
      t.status !== "closed",
  ).length;

  const hasActiveFilter = Boolean(
    filter.status || filter.priority || filter.category,
  );

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Servicing"
        description="Client and event service tickets — questions, issues, and follow-through during and after a job."
        action={
          <NewTicketForm
            contacts={formOptions.contacts}
            companies={formOptions.companies}
            events={formOptions.events}
            staff={staff}
          />
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <CountStat label="Open" value={openCount} />
          <CountStat label="In progress" value={inProgressCount} />
          <CountStat label="Urgent" value={urgentCount} />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Status</span>
            {STATUS_PILLS.map((p) => {
              const active = filter.status === p.value;
              return (
                <Link
                  key={p.value}
                  href={filterHref(filter, "status", p.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-navy bg-navy text-cream"
                      : "border-line bg-cream text-muted hover:border-navy hover:text-navy"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Priority</span>
            {PRIORITY_PILLS.map((p) => {
              const active = filter.priority === p.value;
              return (
                <Link
                  key={p.value}
                  href={filterHref(filter, "priority", p.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-navy bg-navy text-cream"
                      : "border-line bg-cream text-muted hover:border-navy hover:text-navy"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
            {hasActiveFilter && (
              <Link
                href="/operations/servicing"
                className="ml-1 text-xs text-muted underline-offset-2 transition hover:text-navy hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
        </div>

        {/* Queue */}
        {tickets.length === 0 ? (
          <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
            {hasActiveFilter
              ? "No tickets match these filters."
              : "No service tickets yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Ticket</th>
                  <th className="px-4 py-3 font-medium text-muted">Category</th>
                  <th className="px-4 py-3 font-medium text-muted">Priority</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Client / Event
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">Assignee</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tickets.map((t: TicketListRow) => {
                  const who =
                    [t.client_name, t.event_title]
                      .filter(Boolean)
                      .join(" · ") || "—";
                  return (
                    <tr key={t.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/operations/servicing/${t.id}`}
                          className="font-medium text-navy underline-offset-2 transition hover:underline"
                        >
                          {t.subject}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={t.category} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-ink">{who}</td>
                      <td className="px-4 py-3 text-ink">
                        {t.assignee_name ?? (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {t.comment_count}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatAge(t.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
