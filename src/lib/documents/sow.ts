/**
 * Statement of Work (customer SOW) model — the structured, immutable payload a
 * SOW document renders from (on-screen and in the signed PDF). A team member
 * builds it (event details + agreed scope line items + times) so the executed
 * SOW is the written record of what was agreed.
 */

export type SowScopeItem = {
  description: string;
  quantity: number;
  amount: number;
};

export type SowPayload = {
  companyName: string;
  eventTitle: string;
  eventDate: string | null;
  startAt: string | null;
  endAt: string | null;
  venueName: string | null;
  guestCount: number | null;
  clientName: string | null;
  clientCompany: string | null;
  scopeItems: SowScopeItem[];
  notes: string | null;
  total: number;
};

export function sowTotal(items: SowScopeItem[]): number {
  return (
    Math.round(
      items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) * 100 +
        Number.EPSILON,
    ) / 100
  );
}

/** Stable canonical text for the tamper-evidence content hash. */
export function sowCanonicalText(p: SowPayload): string {
  const lines = p.scopeItems
    .map(
      (i) =>
        `${i.description} | qty ${i.quantity} | $${Number(i.amount).toFixed(2)}`,
    )
    .join("\n");
  return [
    `${p.companyName} — Statement of Work`,
    `Event: ${p.eventTitle}`,
    `Date: ${p.eventDate ?? ""}`,
    `Window: ${p.startAt ?? ""} – ${p.endAt ?? ""}`,
    `Venue: ${p.venueName ?? ""}`,
    `Guests: ${p.guestCount ?? ""}`,
    `Client: ${p.clientName ?? ""}${p.clientCompany ? ` (${p.clientCompany})` : ""}`,
    "",
    "Scope:",
    lines,
    "",
    `Total: $${p.total.toFixed(2)}`,
    `Notes: ${p.notes ?? ""}`,
  ].join("\n");
}
