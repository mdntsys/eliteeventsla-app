import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getInvoice } from "@/lib/accounting/queries";
import { formatMoney, formatDate, formatDateTime } from "@/lib/accounting/format";
import { PageHeader } from "@/components/ui/page-header";
import {
  InvoiceStatusBadge,
  PaymentStatusBadge,
  methodLabel,
} from "@/components/accounting/accounting-badges";
import { InvoiceStatusControl } from "@/components/accounting/invoice-status-control";
import { PaymentForm } from "@/components/accounting/payment-form";
import { StripeLinkButton } from "@/components/accounting/stripe-link-button";
import { PrintInvoiceButton } from "@/components/accounting/print-invoice-button";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("accounting");
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const balance = Math.max(
    (invoice.total_amount ?? 0) - (invoice.amount_paid ?? 0),
    0,
  );

  const links = [
    invoice.event_id && invoice.event_title
      ? { href: `/events/${invoice.event_id}`, label: invoice.event_title }
      : null,
    invoice.contact_id && invoice.contact_name
      ? { href: `/crm/contacts/${invoice.contact_id}`, label: invoice.contact_name }
      : null,
    invoice.company_id && invoice.company_name
      ? { href: `/crm/companies/${invoice.company_id}`, label: invoice.company_name }
      : null,
  ].filter((x): x is { href: string; label: string } => x !== null);

  return (
    <>
      <Link
        href="/accounting/invoices"
        className="mb-4 inline-block text-sm text-muted underline-offset-2 transition hover:text-navy print:hidden"
      >
        ← Invoices
      </Link>

      {/* Print-only document header (hidden on screen). */}
      <div className="mb-8 hidden border-b border-line pb-6 print:block">
        <p className="font-display text-2xl font-light text-navy">
          Elite Events LA
        </p>
        <div className="mt-4 flex justify-between gap-6 text-sm">
          <div>
            <p className="eyebrow">Bill to</p>
            <p className="mt-1 text-ink">
              {links.length > 0
                ? links.map((l) => l.label).join(" · ")
                : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-light text-navy">
              Invoice{" "}
              {invoice.invoice_number ?? invoice.id.slice(0, 8)}
            </p>
            <p className="mt-1 text-muted">
              Issued {formatDate(invoice.issued_date)} · Due{" "}
              {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          eyebrow="Accounting"
          title={invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
          description={
            links.length > 0
              ? links.map((l) => l.label).join(" · ")
              : "No linked client."
          }
          action={
            <div className="flex items-center gap-3">
              <InvoiceStatusBadge status={invoice.status} />
              <InvoiceStatusControl id={invoice.id} status={invoice.status} />
              <PrintInvoiceButton />
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 print:block print:space-y-6">
        {/* Main: line items + totals */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Description</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Qty</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Unit</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Amount</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No line items.
                    </td>
                  </tr>
                ) : (
                  invoice.line_items.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3 text-ink">{it.description}</td>
                      <td className="px-4 py-3 text-right text-muted tabular-nums">
                        {it.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-muted tabular-nums">
                        {formatMoney(it.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">
                        {formatMoney(it.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="border-t border-line p-4">
              <dl className="ml-auto w-full max-w-xs text-sm">
                <div className="flex justify-between py-1">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-ink tabular-nums">
                    {formatMoney(invoice.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted">Tax</dt>
                  <dd className="text-ink tabular-nums">
                    {formatMoney(invoice.tax)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line py-2 font-medium">
                  <dt className="text-ink">Total</dt>
                  <dd className="text-navy tabular-nums">
                    {formatMoney(invoice.total_amount)}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted">Paid</dt>
                  <dd className="text-ink tabular-nums">
                    {formatMoney(invoice.amount_paid)}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted">Balance</dt>
                  <dd
                    className={`tabular-nums ${balance > 0 ? "text-ink" : "text-green-700"}`}
                  >
                    {formatMoney(balance)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Payments */}
          <div className="rounded-(--radius-card) border border-line bg-card p-6 print:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-light text-navy">
                Payments
              </h2>
              <PaymentForm
                invoiceId={invoice.id}
                eventId={invoice.event_id ?? undefined}
              />
            </div>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {invoice.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="font-medium text-ink tabular-nums">
                        {formatMoney(p.amount)}
                      </p>
                      <p className="text-xs text-muted">
                        {methodLabel(p.method)} ·{" "}
                        {formatDateTime(p.paid_at ?? p.created_at)}
                      </p>
                    </div>
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar: meta + actions */}
        <div className="flex flex-col gap-6">
          <div className="rounded-(--radius-card) border border-line bg-card p-6">
            <h2 className="eyebrow mb-3">Details</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Issued</dt>
                <dd className="text-ink">{formatDate(invoice.issued_date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Due</dt>
                <dd className="text-ink">{formatDate(invoice.due_date)}</dd>
              </div>
              {links.map((l) => (
                <div key={l.href} className="flex justify-between gap-3">
                  <dt className="text-muted">Linked</dt>
                  <dd className="text-right">
                    <Link
                      href={l.href}
                      className="text-navy underline-offset-2 hover:underline"
                    >
                      {l.label}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
            {invoice.notes && (
              <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
                {invoice.notes}
              </p>
            )}
          </div>

          <div className="rounded-(--radius-card) border border-line bg-card p-6 print:hidden">
            <h2 className="eyebrow mb-3">Collect payment</h2>
            <StripeLinkButton invoiceId={invoice.id} />
          </div>
        </div>
      </div>
    </>
  );
}
