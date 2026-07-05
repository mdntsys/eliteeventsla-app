import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { canView, canEdit } from "@/lib/auth/roles";
import {
  getEvent,
  listStaff,
  listCrew,
  checkAvailability,
  listEventInvoices,
  getEventCrewConflicts,
} from "@/lib/events/queries";
import { listInventory } from "@/lib/inventory/queries";
import { listEventVendors, listVendorsForPicker } from "@/lib/vendors/queries";
import { listEventTickets } from "@/lib/servicing/queries";
import { PageHeader } from "@/components/ui/page-header";
import { EventStatusControl } from "@/components/events/event-status-control";
import { TimelinePanel } from "@/components/events/timeline-panel";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { InventoryPanel } from "@/components/events/inventory-panel";
import { ReturnsPanel } from "@/components/events/returns-panel";
import { EventVendorsPanel } from "@/components/events/event-vendors-panel";
import { EventTicketsPanel } from "@/components/servicing/event-tickets-panel";
import { JobStageTracker } from "@/components/events/job-stage-tracker";
import { ReadinessChecklist } from "@/components/events/readiness-checklist";
import { ProfitabilitySummary } from "@/components/events/profitability-summary";
import { EventBillingPanel } from "@/components/events/event-billing-panel";
import {
  deriveStage,
  computeReadiness,
  computeProfitability,
} from "@/lib/events/lifecycle";
import type { Availability } from "@/lib/events/types";

export const metadata: Metadata = { title: "Event" };

const EVENT_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate",
  wedding: "Wedding",
  personal: "Personal",
  other: "Other",
};

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatEventDate(value: string | null): string {
  if (!value) return "Date TBD";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatWindow(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

function formatTimestamp(value: string | null): string {
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

/**
 * Resolve the job window used to test inventory availability. Prefer explicit
 * start_at/end_at; otherwise fall back to the event_date as a full-day window.
 */
function resolveWindow(ev: {
  start_at: string | null;
  end_at: string | null;
  event_date: string | null;
}): { fromISO: string; toISO: string } | null {
  if (ev.start_at || ev.end_at) {
    const from = ev.start_at ?? ev.end_at;
    const to = ev.end_at ?? ev.start_at;
    return { fromISO: from as string, toISO: to as string };
  }
  if (ev.event_date) {
    const from = new Date(`${ev.event_date}T00:00:00`);
    const to = new Date(`${ev.event_date}T23:59:59`);
    return { fromISO: from.toISOString(), toISO: to.toISOString() };
  }
  return null;
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireView("events");
  const { id } = await params;
  const canBill = canView(profile, "accounting");
  const canEditEvents = canEdit(profile, "events");

  const [ev, staff, crew, inventory] = await Promise.all([
    getEvent(id),
    listStaff(),
    listCrew(),
    listInventory(),
  ]);

  if (!ev) notFound();

  // Vendors tied to this job + the active-vendor picker source for the panel,
  // plus the service tickets logged against this job for the servicing panel.
  const [eventVendors, vendorOptions, eventTickets, eventInvoices, crewConflicts] =
    await Promise.all([
      listEventVendors(ev.id),
      listVendorsForPicker(),
      listEventTickets(ev.id),
      listEventInvoices(ev.id),
      getEventCrewConflicts(ev.id),
    ]);

  // Compute availability per distinct event-item inventory_item_id over the job
  // window. excludeEventId is left undefined so this job's own reserved units
  // surface as conflicts attributed to this event ("this job").
  const availabilityByItem: Record<string, Availability> = {};
  const window = resolveWindow(ev);
  if (window) {
    const distinctItemIds = Array.from(
      new Set(ev.items.map((i) => i.inventory_item_id)),
    );
    const results = await Promise.all(
      distinctItemIds.map((itemId) =>
        checkAvailability(itemId, window.fromISO, window.toISO).then(
          (availability) => [itemId, availability] as const,
        ),
      ),
    );
    for (const [itemId, availability] of results) {
      availabilityByItem[itemId] = availability;
    }
  }

  // Derive the lifecycle stage + dispatch readiness from already-fetched data.
  const stage = deriveStage({ status: ev.status, items: ev.items });
  const readiness = computeReadiness({
    items: ev.items,
    schedule: ev.schedule,
    vendors: eventVendors,
    tickets: eventTickets,
  });

  // Gross profitability from already-fetched figures (contracted total vs
  // summed agreed vendor cost). Hidden on brand-new jobs with no money yet.
  const profitability = computeProfitability({
    totalAmount: ev.total_amount,
    vendors: eventVendors,
  });
  const showProfitability =
    profitability.revenue !== 0 || profitability.vendorCost !== 0;

  // Billing panel: show once there's something to bill (a price or any invoice).
  const showBilling =
    eventInvoices.length > 0 || (ev.total_amount ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Operations / Events"
        title={ev.title}
        description={
          [ev.client_name, ev.company_name].filter(Boolean).join(" · ") ||
          undefined
        }
        action={
          <Link
            href="/events"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All events
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <JobStageTracker
          current={{ key: stage.key, index: stage.index }}
          status={ev.status}
        />

        <ReadinessChecklist items={readiness} />

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
              </p>
              <p className="font-display mt-0.5 text-lg font-light text-navy">
                {formatEventDate(ev.event_date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="eyebrow">Status</span>
              <EventStatusControl eventId={ev.id} status={ev.status} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryField label="Venue">
              {ev.venue_name ?? "—"}
              {ev.venue_address && (
                <span className="mt-0.5 block text-xs text-muted">
                  {ev.venue_address}
                </span>
              )}
            </SummaryField>
            <SummaryField label="Guests">
              {ev.guest_count != null ? ev.guest_count : "—"}
            </SummaryField>
            <SummaryField label="Window">
              {formatWindow(ev.start_at, ev.end_at)}
            </SummaryField>
            <SummaryField label="Total">
              {formatCurrency(ev.total_amount)}
            </SummaryField>
            <SummaryField label="Actual start">
              {formatTimestamp(ev.actual_start_at)}
            </SummaryField>
            <SummaryField label="Actual end">
              {formatTimestamp(ev.actual_end_at)}
            </SummaryField>
          </div>

          {ev.notes && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {ev.notes}
              </p>
            </div>
          )}
        </section>

        {showProfitability && <ProfitabilitySummary data={profitability} />}

        {showBilling && (
          <EventBillingPanel invoices={eventInvoices} canBill={canBill} />
        )}

        <InventoryPanel
          ev={ev}
          availabilityByItem={availabilityByItem}
          inventory={inventory}
        />

        <TimelinePanel
          ev={ev}
          staff={staff}
          crew={crew}
          crewConflicts={crewConflicts}
        />

        <EventVendorsPanel
          eventId={ev.id}
          rows={eventVendors}
          vendorOptions={vendorOptions}
        />

        <EventTicketsPanel eventId={ev.id} rows={eventTickets} staff={staff} />

        <ReturnsPanel ev={ev} />

        {canEdit(profile, "documents") && (
          <section className="rounded-(--radius-card) border border-line bg-card p-6">
            <p className="eyebrow">Documents</p>
            <h2 className="font-display mt-0.5 text-xl font-light text-navy">
              Statement of Work
            </h2>
            <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
              Build an SOW seeded from this event&rsquo;s details and billed
              scope, then send it to the client to sign.
            </p>
            <Link
              href={`/documents/new?event=${ev.id}`}
              className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
            >
              Create SOW
            </Link>
          </section>
        )}

        {canEditEvents && (
          <section className="rounded-(--radius-card) border border-red-200 bg-red-50/40 p-6">
            <p className="eyebrow text-red-700">Danger zone</p>
            <h2 className="font-display mt-0.5 text-xl font-light text-navy">
              Delete this event
            </h2>
            <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
              Removes the event and everything attached to it — schedule,
              reserved items, vendors, and notes. Invoices and recorded payments
              are kept (an event with payments can&rsquo;t be deleted). This
              can&rsquo;t be undone.
            </p>
            <DeleteEventButton eventId={ev.id} eventTitle={ev.title} />
          </section>
        )}
      </div>
    </>
  );
}
