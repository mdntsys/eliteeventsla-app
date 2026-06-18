import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { PriorityBadge } from "@/components/servicing/priority-badge";
import { NAV_SECTIONS } from "@/components/nav-config";
import { canAccess, ROLE_LABELS } from "@/lib/auth/roles";
import {
  DashboardCard,
  EmptyState,
  ListRow,
} from "@/components/dashboard/dashboard-card";
import {
  upcomingLogistics,
  pendingReturns,
  unconfirmedVendors,
  openHotTickets,
  jobsByStatus,
  upcomingFollowUps,
} from "@/lib/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  setup: "Setup",
  teardown: "Teardown",
};

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Inquiry",
  quoted: "Quoted",
  booked: "Booked",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const role = profile.role!; // (app)/layout guarantees a non-null role here.
  const firstName = profile.full_name?.split(" ")[0];

  const [logistics, returns, vendors, tickets, jobs, followUps] =
    await Promise.all([
      upcomingLogistics(7),
      pendingReturns(),
      unconfirmedVendors(),
      openHotTickets(),
      jobsByStatus(),
      upcomingFollowUps(8),
    ]);

  // Role-aware quick links: the same gating the sidebar uses.
  const quickLinks = NAV_SECTIONS.filter(
    (section) =>
      section.module !== "dashboard" && canAccess(role, section.module),
  ).flatMap((section) => section.items);

  const canOps = canAccess(role, "operations");
  const canEvents = canAccess(role, "events");
  const canCrm = canAccess(role, "crm");

  return (
    <>
      <PageHeader
        eyebrow={`Signed in · ${ROLE_LABELS[role]}`}
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Today across the floor — what's moving, what's still out, and who needs a nudge."
      />

      {quickLinks.length > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium text-muted transition hover:border-navy hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Coming up — schedule */}
        <DashboardCard
          title="Coming up"
          href={canOps ? "/operations/scheduling" : undefined}
          count={logistics.length}
        >
          {logistics.length === 0 ? (
            <EmptyState>Nothing scheduled in the next 7 days.</EmptyState>
          ) : (
            <div>
              {logistics.map((item) => (
                <ListRow key={item.id}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted tabular-nums">
                        {formatDateTime(item.scheduled_start)}
                      </span>
                      <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-[0.7rem] font-medium text-muted">
                        {SCHEDULE_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                    {canEvents ? (
                      <Link
                        href={`/events/${item.event_id}`}
                        className="mt-1 block truncate font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {item.event_title}
                      </Link>
                    ) : (
                      <span className="mt-1 block truncate font-medium text-navy">
                        {item.event_title}
                      </span>
                    )}
                    {item.assignees.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {item.assignees.join(", ")}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </ListRow>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Pending returns */}
        <DashboardCard
          title="Pending returns"
          href={canEvents ? "/events" : undefined}
          count={returns.length}
        >
          {returns.length === 0 ? (
            <EmptyState>Nothing out.</EmptyState>
          ) : (
            <div>
              {returns.map((item) => (
                <ListRow key={item.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {item.label}
                    </p>
                    {canEvents ? (
                      <Link
                        href={`/events/${item.event_id}`}
                        className="mt-0.5 block truncate text-xs text-navy underline-offset-2 hover:underline"
                      >
                        {item.event_title}
                      </Link>
                    ) : (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {item.event_title}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {formatShortDate(item.checked_out_at)}
                  </span>
                </ListRow>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Awaiting vendor confirmation */}
        <DashboardCard
          title="Awaiting vendor confirmation"
          href={canOps ? "/operations/vendors" : undefined}
          count={vendors.length}
        >
          {vendors.length === 0 ? (
            <EmptyState>No vendors awaiting confirmation.</EmptyState>
          ) : (
            <div>
              {vendors.map((item) => (
                <ListRow key={item.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {item.vendor_name}
                    </p>
                    {item.service && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {item.service}
                      </p>
                    )}
                  </div>
                  {canEvents ? (
                    <Link
                      href={`/events/${item.event_id}`}
                      className="shrink-0 text-xs text-navy underline-offset-2 hover:underline"
                    >
                      {item.event_title}
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">
                      {item.event_title}
                    </span>
                  )}
                </ListRow>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Urgent tickets */}
        <DashboardCard
          title="Urgent tickets"
          href={canOps ? "/operations/servicing" : undefined}
          count={tickets.length}
        >
          {tickets.length === 0 ? (
            <EmptyState>No urgent or high-priority tickets open.</EmptyState>
          ) : (
            <div>
              {tickets.map((item) => (
                <ListRow key={item.id}>
                  <div className="min-w-0">
                    {canOps ? (
                      <Link
                        href={`/operations/servicing/${item.id}`}
                        className="block truncate font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {item.subject}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium text-navy">
                        {item.subject}
                      </span>
                    )}
                    {item.event_title && (
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {item.event_title}
                      </p>
                    )}
                  </div>
                  <PriorityBadge priority={item.priority} />
                </ListRow>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Jobs by stage */}
        <DashboardCard
          title="Jobs by stage"
          href={canEvents ? "/events" : undefined}
        >
          {jobs.length === 0 ? (
            <EmptyState>No jobs yet.</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2">
              {jobs.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center gap-2 rounded-full border border-line bg-cream px-3 py-1.5"
                >
                  <span className="text-sm text-muted">
                    {STATUS_LABELS[row.status] ?? row.status.replace(/_/g, " ")}
                  </span>
                  <span className="font-display text-base font-light text-navy tabular-nums">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Follow-ups due */}
        <DashboardCard
          title="Follow-ups due"
          href={canCrm ? "/crm" : undefined}
          count={followUps.length}
        >
          {followUps.length === 0 ? (
            <EmptyState>No follow-ups due.</EmptyState>
          ) : (
            <div>
              {followUps.map((item) => (
                <ListRow key={item.id}>
                  <div className="min-w-0">
                    <Link
                      href={item.href}
                      className="block truncate font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {item.subject}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {item.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {formatShortDate(item.due_at)}
                  </span>
                </ListRow>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </>
  );
}
