import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getTicket } from "@/lib/servicing/queries";
import { listStaff } from "@/lib/events/queries";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { PriorityBadge } from "@/components/servicing/priority-badge";
import { TicketControls } from "@/components/servicing/ticket-controls";
import { CommentThread } from "@/components/servicing/comment-thread";
import { AddCommentForm } from "@/components/servicing/add-comment-form";

export const metadata: Metadata = { title: "Ticket" };

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  delivery: "Delivery",
  equipment: "Equipment",
  billing: "Billing",
  change_request: "Change request",
  complaint: "Complaint",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("servicing");
  const { id } = await params;

  const [ticket, staff] = await Promise.all([getTicket(id), listStaff()]);

  if (!ticket) notFound();

  const isResolved =
    ticket.status === "resolved" || ticket.status === "closed";

  return (
    <>
      <PageHeader
        eyebrow="Operations / Servicing"
        title={ticket.subject}
        description={CATEGORY_LABELS[ticket.category] ?? ticket.category}
        action={
          <Link
            href="/operations/servicing"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All tickets
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            </span>
          </div>

          {ticket.description && (
            <p className="mb-6 whitespace-pre-line text-sm text-ink">
              {ticket.description}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryField label="Event">
              {ticket.event_id ? (
                <Link
                  href={`/events/${ticket.event_id}`}
                  className="text-navy underline-offset-2 transition hover:underline"
                >
                  {ticket.event_title ?? "View event"}
                </Link>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Client">
              {ticket.client_name ?? "—"}
            </SummaryField>
            <SummaryField label="Assignee">
              {ticket.assignee_name ?? "Unassigned"}
            </SummaryField>
            <SummaryField label="Opened">
              {formatTime(ticket.created_at)}
            </SummaryField>
          </div>

          {isResolved && ticket.resolved_at && (
            <div className="mt-5 border-t border-line pt-4">
              <SummaryField label="Resolved">
                {formatTime(ticket.resolved_at)}
              </SummaryField>
            </div>
          )}
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <p className="eyebrow mb-4">Manage</p>
          <TicketControls ticket={ticket} staff={staff} />
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-light text-navy">
              Activity
            </h2>
            <span className="eyebrow">{ticket.comments.length} notes</span>
          </div>

          <div className="mb-6">
            <CommentThread comments={ticket.comments} />
          </div>

          <div className="border-t border-line pt-5">
            <AddCommentForm ticketId={ticket.id} eventId={ticket.event_id} />
          </div>
        </section>
      </div>
    </>
  );
}
