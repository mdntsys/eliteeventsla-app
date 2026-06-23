import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { accountingOverview } from "@/lib/accounting/queries";
import { formatMoney, formatDateTime } from "@/lib/accounting/format";
import { PageHeader } from "@/components/ui/page-header";
import {
  PaymentStatusBadge,
  methodLabel,
} from "@/components/accounting/accounting-badges";

export const metadata: Metadata = { title: "Accounting" };

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "good";
}) {
  const valueColor =
    tone === "warn"
      ? "text-red-700"
      : tone === "good"
        ? "text-green-700"
        : "text-navy";
  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-5">
      <p className="eyebrow">{label}</p>
      <p className={`font-display mt-2 text-3xl font-light tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function AccountingOverviewPage() {
  await requireView("accounting");
  const overview = await accountingOverview();

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Overview"
        description="Money at a glance — outstanding balances, recent payments, and jobs awaiting reconciliation."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(overview.outstanding)}
          hint={`${overview.openCount} open ${overview.openCount === 1 ? "invoice" : "invoices"}`}
        />
        <StatCard
          label="Overdue"
          value={formatMoney(overview.overdueAmount)}
          hint={`${overview.overdueCount} past due`}
          tone={overview.overdueAmount > 0 ? "warn" : "default"}
        />
        <StatCard
          label="Collected"
          value={formatMoney(overview.paidTotal)}
          hint="All recorded payments"
          tone="good"
        />
        <StatCard
          label="Drafts"
          value={String(overview.draftCount)}
          hint={`${overview.invoiceCount} invoices total`}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-light text-navy">
              Recent payments
            </h2>
            <Link
              href="/accounting/payments"
              className="text-sm text-navy underline-offset-2 hover:underline"
            >
              View all →
            </Link>
          </div>
          {overview.recentPayments.length === 0 ? (
            <p className="text-sm text-muted">No payments recorded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {overview.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink tabular-nums">
                      {formatMoney(p.amount)}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {methodLabel(p.method)} ·{" "}
                      {p.invoice_number ?? p.event_title ?? "—"} ·{" "}
                      {formatDateTime(p.paid_at ?? p.created_at)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-(--radius-card) border border-line bg-card p-6">
          <h2 className="font-display text-xl font-light text-navy">
            Jump to
          </h2>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/accounting/invoices"
              className="rounded-(--radius-card) border border-line px-4 py-3 text-sm text-ink transition hover:border-navy hover:text-navy"
            >
              Invoices — create, send, and track balances →
            </Link>
            <Link
              href="/accounting/payments"
              className="rounded-(--radius-card) border border-line px-4 py-3 text-sm text-ink transition hover:border-navy hover:text-navy"
            >
              Payments — record and reconcile against invoices →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
