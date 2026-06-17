/**
 * Pure, dependency-free lifecycle helpers for the event/job pipeline.
 *
 * No "use server", no DB, no React — safe to import from both server and
 * client components. The hub and scheduling surfaces compute stage + readiness
 * from data they have already fetched; keep everything here deterministic.
 */

// --- Job stages -------------------------------------------------------------

export type JobStageKey =
  | "draft"
  | "confirmed"
  | "prepped"
  | "in_progress"
  | "returned"
  | "completed"
  | "cancelled";

/**
 * The ordered display pipeline. 'cancelled' is intentionally omitted — it is a
 * terminal off-pipeline state handled separately by the UI.
 */
export const JOB_STAGES: { key: JobStageKey; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "prepped", label: "Prepped" },
  { key: "in_progress", label: "On the road / In progress" },
  { key: "returned", label: "Returned" },
  { key: "completed", label: "Closed" },
];

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

type StageItem = {
  checked_out_at: string | null;
  returned_at: string | null;
};

/**
 * Derive the display stage from the event status plus item check-out/return
 * progress. Deterministic and intentionally simple:
 *
 *  - completed status            -> Closed
 *  - cancelled status            -> Cancelled (off-pipeline)
 *  - draft status                -> Draft
 *  - in_progress status          -> On the road / In progress, unless every
 *                                   item is returned (-> Returned)
 *  - confirmed status:
 *      - all items returned (>=1) -> Returned
 *      - any item checked out     -> On the road / In progress
 *      - otherwise                -> Confirmed
 */
export function deriveStage(args: {
  status: string;
  items: StageItem[];
}): { key: JobStageKey; label: string; index: number } {
  const { status, items } = args;

  const resolve = (key: JobStageKey): {
    key: JobStageKey;
    label: string;
    index: number;
  } => {
    const idx = JOB_STAGES.findIndex((s) => s.key === key);
    const label =
      JOB_STAGES.find((s) => s.key === key)?.label ??
      (key === "cancelled" ? "Cancelled" : key);
    return { key, label, index: idx };
  };

  if (status === "cancelled") return resolve("cancelled");
  if (status === "completed") return resolve("completed");
  if (status === "draft") return resolve("draft");

  const hasItems = items.length > 0;
  const anyCheckedOut = items.some((i) => i.checked_out_at !== null);
  const allReturned = hasItems && items.every((i) => i.returned_at !== null);

  if (status === "in_progress") {
    if (allReturned) return resolve("returned");
    return resolve("in_progress");
  }

  // confirmed (and any other non-terminal status falls through here too)
  if (allReturned) return resolve("returned");
  if (anyCheckedOut) return resolve("in_progress");
  return resolve("confirmed");
}

// --- Readiness checklist ----------------------------------------------------

type ReadinessItemRow = {
  checked_out_at?: string | null;
  returned_at?: string | null;
  // availability info, when the caller has it
  available?: boolean | null;
};

type ReadinessAssignment = { profile_id?: string | null };

type ReadinessScheduleRow = {
  type?: string | null;
  assignments?: ReadinessAssignment[] | null;
};

type ReadinessVendor = { status?: string | null };

type ReadinessTicket = {
  priority?: string | null;
  status?: string | null;
};

/**
 * Four "ready for dispatch" checks computed from already-fetched data. Every
 * input is treated defensively so callers can pass the shapes they happen to
 * have without breaking the contract.
 */
export function computeReadiness(args: {
  items: ReadinessItemRow[];
  schedule: ReadinessScheduleRow[];
  vendors: ReadinessVendor[];
  tickets: ReadinessTicket[];
}): ReadinessItem[] {
  const items = args.items ?? [];
  const schedule = args.schedule ?? [];
  const vendors = args.vendors ?? [];
  const tickets = args.tickets ?? [];

  // 1) Inventory reserved.
  const hasItems = items.length > 0;
  const unavailableCount = items.filter(
    (i) => i.available === false,
  ).length;
  const inventory: ReadinessItem = {
    key: "inventory",
    label: "Inventory reserved",
    ok: hasItems && unavailableCount === 0,
    detail: !hasItems
      ? "No items reserved yet."
      : unavailableCount > 0
        ? `${unavailableCount} reserved ${
            unavailableCount === 1 ? "item is" : "items are"
          } flagged unavailable.`
        : `${items.length} ${
            items.length === 1 ? "item" : "items"
          } reserved.`,
  };

  // 2) Crew assigned. Stops that need crew = delivery/setup.
  const crewStops = schedule.filter(
    (s) => s.type === "delivery" || s.type === "setup",
  );
  const totalAssignments = schedule.reduce(
    (n, s) => n + (s.assignments?.length ?? 0),
    0,
  );
  const crewStopsCovered = crewStops.filter(
    (s) => (s.assignments?.length ?? 0) > 0,
  ).length;
  const crewOk =
    totalAssignments > 0 &&
    (crewStops.length === 0 || crewStopsCovered === crewStops.length);
  const crew: ReadinessItem = {
    key: "crew",
    label: "Crew assigned",
    ok: crewOk,
    detail:
      totalAssignments === 0
        ? "No crew assigned to any stop."
        : crewStops.length === 0
          ? `${totalAssignments} ${
              totalAssignments === 1 ? "assignment" : "assignments"
            }.`
          : crewStopsCovered === crewStops.length
            ? `All ${crewStops.length} delivery/setup ${
                crewStops.length === 1 ? "stop" : "stops"
              } covered.`
            : `${crewStopsCovered}/${crewStops.length} delivery/setup stops covered.`,
  };

  // 3) Vendors confirmed (none still 'proposed').
  const proposed = vendors.filter((v) => v.status === "proposed").length;
  const vendorsOk = proposed === 0;
  const vendorsItem: ReadinessItem = {
    key: "vendors",
    label: "Vendors confirmed",
    ok: vendorsOk,
    detail:
      vendors.length === 0
        ? "No vendors attached."
        : proposed === 0
          ? `${vendors.length} ${
              vendors.length === 1 ? "vendor" : "vendors"
            } confirmed.`
          : `${proposed} ${
              proposed === 1 ? "vendor" : "vendors"
            } still proposed.`,
  };

  // 4) No open urgent/high tickets.
  const openHot = tickets.filter(
    (t) =>
      (t.priority === "urgent" || t.priority === "high") &&
      (t.status === "open" || t.status === "in_progress"),
  ).length;
  const ticketsOk = openHot === 0;
  const ticketsItem: ReadinessItem = {
    key: "tickets",
    label: "No open urgent tickets",
    ok: ticketsOk,
    detail:
      openHot === 0
        ? "No open urgent or high-priority tickets."
        : `${openHot} open urgent/high ${
            openHot === 1 ? "ticket" : "tickets"
          }.`,
  };

  return [inventory, crew, vendorsItem, ticketsItem];
}
