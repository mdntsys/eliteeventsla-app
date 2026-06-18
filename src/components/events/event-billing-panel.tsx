import Link from "next/link";
import type { EventInvoiceRow } from "@/lib/events/types";
import { formatMoney, formatDate } from "@/lib/accounting/format";
import { InvoiceStatusBadge } from "@/components/accounting/accounting-badges";

/**
 * Billing-readiness for a job, on the event hub: is it invoiced, and what's
 * still outstanding — without a trip to Accounting. Invoices are readable by
 * any role (broad RLS read), but only accounting/admin can act on them, so the
 * links into Accounting render only when `canBill` is true.
 */
export function EventBillingPanel({
  invoices,
  canBill,
}: {
  invoices: EventInvoiceRow[];
  canBill: boolean;
}) {
  const billable = invoices.filter((i) => i.status !== "void");
  const invoiced = billable.reduce((sum, i) => sum + i.total_amount, 0);
  const paid = billable.reduce((sum, i) => sum + i.amount_paid, 0);
  const outstanding = invoiced - paid;
  const hasOverdue = invoices.some((i) => i.status === "overdue");

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-light text-navy">Billing</h2>
        {canBill && (
          <Link
            href="/accounting/invoices"
            className="text-sm text-navy underline-offset-2 hover:underline"
          >
            {invoices.length === 0 ? "Create invoice →" : "Open in Accounting →"}
          </Link>
        )}
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          Not invoiced yet.
          {canBill ? " Create an invoice from Accounting to bill this job." : ""}
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="eyebrow">Invoiced</p>
              <p className="mt-1 text-sm text-ink">{formatMoney(invoiced)}</p>
            </div>
            <div>
              <p className="eyebrow">Paid</p>
              <p className="mt-1 text-sm text-ink">{formatMoney(paid)}</p>
            </div>
            <div>
              <p className="eyebrow">Outstanding</p>
              <p
                className={`mt-1 text-sm font-medium ${
                  outstanding > 0 ? "text-navy" : "text-ink"
                }`}
              >
                {formatMoney(outstanding)}
                {hasOverdue && (
                  <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    Overdue
                  </span>
                )}
              </p>
            </div>
          </div>

          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
            {invoices.map((inv) => {
              const balance = inv.total_amount - inv.amount_paid;
              const label = inv.invoice_number ?? "Draft invoice";
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-cream px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    {canBill ? (
                      <Link
                        href={`/accounting/invoices/${inv.id}`}
                        className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-ink">
                        {label}
                      </span>
                    )}
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <span className="text-muted">
                      Due {formatDate(inv.due_date)}
                    </span>
                    <span className="text-ink tabular-nums">
                      {formatMoney(inv.total_amount)}
                    </span>
                    <span className="w-24 text-right tabular-nums text-muted">
                      {balance > 0
                        ? `${formatMoney(balance)} due`
                        : "Settled"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
