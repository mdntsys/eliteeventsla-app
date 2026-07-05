import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import {
  getAffiliate,
  getAffiliateEarnings,
  getAffiliateTaxInfo,
  listAffiliateCommissions,
  listAffiliatePayouts,
} from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { AffiliateEditForm } from "@/components/affiliates/affiliate-edit-form";
import { AffiliateTaxPanel } from "@/components/affiliates/affiliate-tax-panel";
import { RecordPayoutButton } from "@/components/affiliates/record-payout-button";

export const metadata: Metadata = { title: "Affiliate" };

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatPct(rate: number): string {
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const COMMISSION_LABELS: Record<string, string> = {
  accrued: "Accrued",
  paid: "Paid",
  reversed: "Reversed",
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

function Field({
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
      <p className="font-display text-2xl font-light text-navy">{value}</p>
      <p className="eyebrow mt-0.5">{label}</p>
    </div>
  );
}

export default async function AffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireView("affiliates");
  const { id } = await params;

  const affiliate = await getAffiliate(id);
  if (!affiliate) notFound();

  const [earnings, commissions, payouts] = await Promise.all([
    getAffiliateEarnings(id),
    listAffiliateCommissions(id),
    listAffiliatePayouts(id),
  ]);

  // EIN + W-9 are super-admin-only (read via service role) — fetch only then.
  const taxInfo = profile.is_super_admin ? await getAffiliateTaxInfo(id) : null;

  return (
    <>
      <PageHeader
        eyebrow="Partners / Affiliates"
        title={affiliate.full_name ?? "Affiliate"}
        description={affiliate.status === "active" ? "Active" : "Inactive"}
        action={
          <div className="flex items-center gap-3">
            <AffiliateEditForm affiliate={affiliate} />
            <RecordPayoutButton
              affiliateId={affiliate.id}
              owed={earnings.owed}
              accruedCount={earnings.accruedCount}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Email">{affiliate.email ?? "—"}</Field>
            <Field label="Phone">{affiliate.phone ?? "—"}</Field>
            <Field label="Commission rate">
              {formatPct(affiliate.commission_rate)}
            </Field>
            <Field label="W-9">
              {affiliate.w9_on_file ? (
                <span className="text-emerald-700">On file</span>
              ) : (
                <span className="text-amber-700">Not on file</span>
              )}
            </Field>
          </div>
          {affiliate.notes && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {affiliate.notes}
              </p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          <Stat label="Owed" value={formatMoney(earnings.owed)} />
          <Stat label="Paid out" value={formatMoney(earnings.paid)} />
          <Stat label="Lifetime" value={formatMoney(earnings.earned)} />
        </div>

        {taxInfo && (
          <AffiliateTaxPanel affiliateId={affiliate.id} taxInfo={taxInfo} />
        )}

        {/* Commissions */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-light text-navy">
            Commissions
          </h2>
          {commissions.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-8 text-center text-sm text-muted">
              No commissions yet. One accrues when an invoice on a deal this
              affiliate referred is fully paid.
            </p>
          ) : (
            <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-3 font-medium text-muted">Event</th>
                      <th className="px-4 py-3 font-medium text-muted">
                        Invoice
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted">
                        Basis
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted">
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted">
                        Commission
                      </th>
                      <th className="px-4 py-3 font-medium text-muted">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-muted">
                        Earned
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {commissions.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="px-4 py-3 text-ink">
                          {c.event_id ? (
                            <Link
                              href={`/events/${c.event_id}`}
                              className="text-navy underline-offset-2 hover:underline"
                            >
                              {c.event_title ?? "Event"}
                            </Link>
                          ) : (
                            (c.event_title ?? "—")
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {c.invoice_number ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-ink tabular-nums">
                          {formatMoney(c.basis_amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted tabular-nums">
                          {formatPct(c.rate)}
                        </td>
                        <td className="px-4 py-3 text-right text-ink tabular-nums">
                          {formatMoney(c.amount)}
                        </td>
                        <td className="px-4 py-3 text-ink">
                          {COMMISSION_LABELS[c.status] ?? c.status}
                        </td>
                        <td className="px-4 py-3 text-right text-muted">
                          {formatDate(c.earned_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Payouts */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-light text-navy">Payouts</h2>
          {payouts.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-8 text-center text-sm text-muted">
              No payouts recorded yet.
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
                      <th className="px-4 py-3 font-medium text-muted">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payouts.map((p) => (
                      <tr key={p.id} className="align-top">
                        <td className="px-4 py-3 text-ink">
                          {formatDate(p.paid_at)}
                        </td>
                        <td className="px-4 py-3 text-right text-ink tabular-nums">
                          {formatMoney(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {p.method ? (METHOD_LABELS[p.method] ?? p.method) : "—"}
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
        </section>
      </div>
    </>
  );
}
