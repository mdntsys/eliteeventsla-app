import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listEvents } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { NewEventForm } from "@/components/events/new-event-form";
import type { EventListRow } from "@/lib/events/types";

export const metadata: Metadata = { title: "Events & Jobs" };

const EVENT_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate",
  wedding: "Wedding",
  personal: "Personal",
  other: "Other",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNextSchedule(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clientLabel(row: EventListRow): string {
  if (row.client_name && row.company_name) {
    return `${row.client_name} · ${row.company_name}`;
  }
  return row.client_name ?? row.company_name ?? "—";
}

async function loadFormOptions() {
  const supabase = await createClient();
  const [{ data: contacts }, { data: companies }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true }),
    supabase.from("companies").select("id, name").order("name", { ascending: true }),
  ]);

  return {
    contacts: (contacts ?? []).map((c) => ({
      id: c.id,
      label: [c.first_name, c.last_name].filter(Boolean).join(" "),
    })),
    companies: (companies ?? []).map((c) => ({ id: c.id, label: c.name })),
  };
}

export default async function EventsPage() {
  await requireModule("events");
  const [events, options] = await Promise.all([listEvents(), loadFormOptions()]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Events & Jobs"
        description="The operational record for every booking — inventory, scheduling, crew, and returns in one command center."
        action={
          <NewEventForm contacts={options.contacts} companies={options.companies} />
        }
      />

      {events.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-line bg-card px-6 py-16 text-center">
          <p className="font-display text-xl font-light text-navy">
            No events yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Create an event to start reserving inventory, scheduling deliveries,
            and assigning your crew.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3">
                    <span className="eyebrow">Event</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="eyebrow">Client</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="eyebrow">Date</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="eyebrow">Type</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="eyebrow">Status</span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="eyebrow">Items</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="eyebrow">Next action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line transition last:border-b-0 hover:bg-cream"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/events/${row.id}`}
                        className="font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {row.title}
                      </Link>
                      {row.venue_name && (
                        <div className="mt-0.5 text-xs text-muted">
                          {row.venue_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{clientLabel(row)}</td>
                    <td className="px-4 py-3 text-ink tabular-nums">
                      {formatDate(row.event_date)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {row.item_count}
                    </td>
                    <td className="px-4 py-3 text-ink tabular-nums">
                      {formatNextSchedule(row.next_schedule_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
