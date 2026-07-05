import type { Metadata } from "next";
import { requirePortalAccess } from "@/lib/portal/auth";
import { getPortalEventHistory } from "@/lib/portal/queries";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney, formatDate } from "@/lib/accounting/format";

export const metadata: Metadata = { title: "Referrals" };

function capitalize(value: string): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function PortalReferralsPage() {
  const { affiliate } = await requirePortalAccess();
  const rows = await getPortalEventHistory(affiliate.id);

  return (
    <>
      <PageHeader title="Referrals" />

      {rows.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No referred events yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Event</th>
                  <th className="px-4 py-3 font-medium text-muted">Date</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Commission
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Commission status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.event_id} className="align-top">
                    <td className="px-4 py-3 text-ink">{r.title ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(r.event_date)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {capitalize(r.status)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {formatMoney(r.commission_amount)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {r.commission_status ?? "—"}
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
