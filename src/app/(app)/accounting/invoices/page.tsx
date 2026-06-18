import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import {
  listInvoices,
  listEventOptions,
  listContactOptions,
  listCompanyOptions,
} from "@/lib/accounting/queries";
import { formatMoney, formatDate } from "@/lib/accounting/format";
import type { InvoiceListRow } from "@/lib/accounting/types";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceStatusBadge } from "@/components/accounting/accounting-badges";
import { InvoiceForm } from "@/components/accounting/invoice-form";

export const metadata: Metadata = { title: "Invoices" };

function client(row: InvoiceListRow): string {
  return (
    [row.contact_name, row.company_name].filter(Boolean).join(" · ") ||
    row.event_title ||
    "—"
  );
}

export default async function InvoicesPage() {
  await requireModule("accounting");

  const [rows, events, contacts, companies] = await Promise.all([
    listInvoices(),
    listEventOptions(),
    listContactOptions(),
    listCompanyOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Invoices"
        description="Invoices tied to events — draft, sent, partial, paid, overdue — with line items and balances."
        action={
          <InvoiceForm
            events={events}
            contacts={contacts}
            companies={companies}
          />
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
          <p className="eyebrow">No invoices yet</p>
          <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
            Bill your first job
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Create an invoice, add line items, and track the balance — then
            attach a Stripe payment link or record payments as they come in.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Invoice</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Status</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Client</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Total</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Balance</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Due</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const balance = Math.max(
                    (row.total_amount ?? 0) - (row.amount_paid ?? 0),
                    0,
                  );
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-line transition last:border-b-0 hover:bg-cream"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/accounting/invoices/${row.id}`}
                          className="font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {row.invoice_number ?? `Invoice ${row.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-ink">{client(row)}</td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">
                        {formatMoney(row.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={balance > 0 ? "text-ink" : "text-muted"}
                        >
                          {formatMoney(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted tabular-nums">
                        {formatDate(row.due_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
