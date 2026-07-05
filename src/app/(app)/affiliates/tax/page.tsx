import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { list1099Report } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "1099 report" };

/** IRS threshold at/above which a 1099-NEC is generally required. */
const REPORTABLE_THRESHOLD = 600;

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function Affiliate1099Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireView("affiliates");
  const sp = await searchParams;

  const currentYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : currentYear;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const rows = await list1099Report(year);
  const grandTotal = rows.reduce((sum, r) => sum + r.paidTotal, 0);
  const reportableCount = rows.filter(
    (r) => r.paidTotal >= REPORTABLE_THRESHOLD,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Partners / Affiliates"
        title="1099 report"
        description="Cash paid to referral partners per calendar year, for year-end 1099-NEC filing. Totals come from recorded payouts (voided payouts excluded)."
        action={
          <Link
            href="/affiliates"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All affiliates
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {years.map((y) => (
              <Link
                key={y}
                href={`/affiliates/tax?year=${y}`}
                className={`rounded-(--radius-card) border px-3.5 py-2 text-sm transition ${
                  y === year
                    ? "border-navy bg-navy text-cream"
                    : "border-line text-muted hover:border-navy hover:text-navy"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
          <a
            href={`/affiliates/tax/export?year=${year}`}
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Export CSV
          </a>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
            <p className="font-display text-2xl font-light text-navy">
              {formatMoney(grandTotal)}
            </p>
            <p className="eyebrow mt-0.5">Paid in {year}</p>
          </div>
          <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
            <p className="font-display text-2xl font-light text-navy">
              {rows.length}
            </p>
            <p className="eyebrow mt-0.5">Partners paid</p>
          </div>
          <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
            <p className="font-display text-2xl font-light text-navy">
              {reportableCount}
            </p>
            <p className="eyebrow mt-0.5">≥ ${REPORTABLE_THRESHOLD}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
            No payouts recorded in {year}.
          </p>
        ) : (
          <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="px-4 py-3 font-medium text-muted">Partner</th>
                    <th className="px-4 py-3 text-right font-medium text-muted">
                      Paid in {year}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted">
                      Payouts
                    </th>
                    <th className="px-4 py-3 font-medium text-muted">W-9</th>
                    <th className="px-4 py-3 font-medium text-muted">1099</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const reportable = r.paidTotal >= REPORTABLE_THRESHOLD;
                    return (
                      <tr key={r.affiliateId} className="align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/affiliates/${r.affiliateId}`}
                            className="text-navy underline-offset-2 hover:underline"
                          >
                            {r.name ?? "Unnamed affiliate"}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted">
                            {r.email ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-ink tabular-nums">
                          {formatMoney(r.paidTotal)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted tabular-nums">
                          {r.payoutCount}
                        </td>
                        <td className="px-4 py-3">
                          {r.w9OnFile ? (
                            <span className="text-emerald-700">On file</span>
                          ) : (
                            <span className="text-amber-700">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {reportable ? (
                            <span
                              className={
                                r.w9OnFile ? "text-ink" : "text-red-700"
                              }
                            >
                              {r.w9OnFile ? "Required" : "Required · no W-9"}
                            </span>
                          ) : (
                            <span className="text-muted">Under threshold</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="max-w-prose text-xs text-muted">
          1099-NEC is generally required for partners paid ${REPORTABLE_THRESHOLD}{" "}
          or more in a calendar year. This report is an operational aid, not tax
          advice — confirm filing obligations with your accountant.
        </p>
      </div>
    </>
  );
}
