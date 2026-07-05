import type { Metadata } from "next";
import Link from "next/link";
import { requireView, getUser } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listScheduleInRange } from "@/lib/events/queries";
import { ScheduleAgenda } from "@/components/events/schedule-agenda";
import { CrewStopCard } from "@/components/events/crew-stop-card";

export const metadata: Metadata = { title: "Scheduling" };

const RANGE_DAYS = 60;

// Elite Events LA operates in Los Angeles; render all schedule days/headings in
// LA time so this server-rendered "My stops" view and the client-rendered "All
// jobs" agenda always agree on which calendar day a stop falls on (a UTC server
// would otherwise date an evening LA stop a day off).
const BUSINESS_TZ = "America/Los_Angeles";

type View = "mine" | "all";

// Default to "all" so assigned crew is visible to whoever's coordinating — "My
// stops" is opt-in via ?view=mine (it only shows stops assigned to you).
function parseView(raw: string | string[] | undefined): View {
  return raw === "mine" ? "mine" : "all";
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  // en-CA yields YYYY-MM-DD; in BUSINESS_TZ so grouping matches the LA heading.
  return d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

function formatDayHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: BUSINESS_TZ,
  });
}

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await requireView("scheduling");

  const { view: viewParam } = await searchParams;
  const view = parseView(viewParam);

  const user = await getUser();
  const userId = user?.id ?? null;

  // Window: from the start of today through ~60 days (two months) out. Computed
  // at request time on the server; days/headings render in BUSINESS_TZ (LA).
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + RANGE_DAYS);

  const entries = await listScheduleInRange(from.toISOString(), to.toISOString());

  // "Mine" = stops with an assignment to the current user.
  const mine = userId
    ? entries.filter((e) =>
        (e.assignments ?? []).some((a) => a.profile_id === userId),
      )
    : [];

  // Group "mine" by day for the crew card list.
  const dated = mine.filter((e) => Boolean(e.scheduled_start));
  const sorted = [...dated].sort(
    (a, b) =>
      new Date(a.scheduled_start as string).getTime() -
      new Date(b.scheduled_start as string).getTime(),
  );
  const groups = new Map<string, typeof sorted>();
  for (const entry of sorted) {
    const key = dayKey(entry.scheduled_start as string);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Scheduling"
        description="Deliveries, pickups, setups, and teardowns across every job for the next two months."
      />

      <nav className="mb-6 inline-flex rounded-(--radius-card) border border-line bg-card p-1 text-sm">
        <Link
          href="/operations/scheduling?view=mine"
          aria-current={view === "mine" ? "page" : undefined}
          className={`rounded-[calc(var(--radius-card)-0.25rem)] px-4 py-1.5 font-medium transition ${
            view === "mine"
              ? "bg-navy text-cream"
              : "text-muted hover:text-navy"
          }`}
        >
          My stops
        </Link>
        <Link
          href="/operations/scheduling?view=all"
          aria-current={view === "all" ? "page" : undefined}
          className={`rounded-[calc(var(--radius-card)-0.25rem)] px-4 py-1.5 font-medium transition ${
            view === "all" ? "bg-navy text-cream" : "text-muted hover:text-navy"
          }`}
        >
          All jobs
        </Link>
      </nav>

      {view === "all" ? (
        <ScheduleAgenda entries={entries} />
      ) : sorted.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
          <p className="eyebrow">No stops assigned to you</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            You have no scheduled deliveries, pickups, setups, or teardowns in
            the next two months. Switch to{" "}
            <Link
              href="/operations/scheduling?view=all"
              className="text-navy underline-offset-2 hover:underline"
            >
              all jobs
            </Link>{" "}
            to see the full agenda.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([key, dayEntries]) => (
            <section key={key}>
              <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
                <h2 className="font-display text-lg font-light text-navy">
                  {formatDayHeading(dayEntries[0].scheduled_start as string)}
                </h2>
                <span className="text-xs text-muted tabular-nums">
                  {dayEntries.length}{" "}
                  {dayEntries.length === 1 ? "stop" : "stops"}
                </span>
              </div>
              <div className="space-y-3">
                {dayEntries.map((entry) => (
                  <CrewStopCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
