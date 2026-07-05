import type { Metadata } from "next";
import { requirePortalAccess } from "@/lib/portal/auth";
import { listAffiliatePayouts } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney, formatDate } from "@/lib/accounting/format";

export const metadata: Metadata = { title: "Payouts" };

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

export default async function PortalPayoutsPage() {
  const { affiliate } = await requirePortalAccess();
  const rows = await listAffiliatePayouts(affiliate.id);

  return (
    <>
      <PageHeader title="Payouts" />

      {rows.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No payouts yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">Method</th>
                  <th className="px-4 py-3 font-medium text-muted">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3 text-ink">
                      {formatDate(p.paid_at)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {p.method ? (METHOD_LABELS[p.method] ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {p.reference ?? "—"}
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
