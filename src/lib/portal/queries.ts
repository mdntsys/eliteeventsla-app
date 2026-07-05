import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Portal read loaders for data the affiliate role has no internal-area RLS for
 * (their referred EVENTS). Read via the service-role client but STRICTLY scoped
 * to the affiliate id resolved from the caller's verified session in
 * requireAffiliate — never a client-supplied id — and returning only
 * partner-safe fields (no client PII / full event record).
 *
 * Their own affiliate row, commissions, payouts, and documents are read through
 * the ordinary owner-scoped RLS queries (they can see those directly).
 */

export type PortalEventRow = {
  event_id: string;
  title: string | null;
  event_date: string | null;
  status: string;
  commission_amount: number | null;
  commission_status: string | null;
};

/** The affiliate's referred events with their per-event commission, newest first. */
export async function getPortalEventHistory(
  affiliateId: string,
): Promise<PortalEventRow[]> {
  const db = createServiceClient();

  const [eventsRes, commissionsRes] = await Promise.all([
    db
      .from("events")
      .select("id, title, event_date, status")
      .eq("affiliate_id", affiliateId)
      .order("event_date", { ascending: false, nullsFirst: false }),
    db
      .from("affiliate_commissions")
      .select("event_id, amount, status")
      .eq("affiliate_id", affiliateId),
  ]);

  const commByEvent = new Map<
    string,
    { amount: number | null; status: string }
  >();
  for (const c of commissionsRes.data ?? []) {
    if (c.event_id) commByEvent.set(c.event_id, { amount: c.amount, status: c.status });
  }

  return (eventsRes.data ?? []).map((e) => {
    const c = commByEvent.get(e.id);
    return {
      event_id: e.id,
      title: e.title,
      event_date: e.event_date,
      status: e.status,
      commission_amount: c?.amount ?? null,
      commission_status: c?.status ?? null,
    };
  });
}
