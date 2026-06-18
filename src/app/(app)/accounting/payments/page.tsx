import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listPayments, listInvoiceOptions } from "@/lib/accounting/queries";
import { formatMoney, formatDateTime } from "@/lib/accounting/format";
import { PageHeader } from "@/components/ui/page-header";
import {
  PaymentStatusBadge,
  methodLabel,
} from "@/components/accounting/accounting-badges";
import { PaymentForm } from "@/components/accounting/payment-form";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireModule("accounting");

  const [rows, invoices] = await Promise.all([
    listPayments(),
    listInvoiceOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Payments"
        description="Payment activity reconciled against jobs — Stripe payment links and their webhook-driven status."
        action={<PaymentForm invoices={invoices} />}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
          <p className="eyebrow">No payments yet</p>
          <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
            Record your first payment
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Log a card, cash, check, or transfer against an invoice — or create a
            Stripe payment link from an invoice and let the webhook update it.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Date</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Amount</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Method</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Status</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Invoice / Event</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-line transition last:border-b-0 hover:bg-cream"
                  >
                    <td className="px-4 py-3 text-muted tabular-nums">
                      {formatDateTime(p.paid_at ?? p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-ink">{methodLabel(p.method)}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      {p.invoice_id ? (
                        <Link
                          href={`/accounting/invoices/${p.invoice_id}`}
                          className="text-navy underline-offset-2 hover:underline"
                        >
                          {p.invoice_number ?? "Invoice"}
                        </Link>
                      ) : (
                        <span className="text-muted">
                          {p.event_title ?? "—"}
                        </span>
                      )}
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
