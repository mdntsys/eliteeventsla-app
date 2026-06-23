import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getQuote } from "@/lib/quotes/queries";
import { formatMoney, formatDate } from "@/lib/accounting/format";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteStatusBadge } from "@/components/quotes/quote-badges";
import { QuoteStatusControl } from "@/components/quotes/quote-status-control";
import { ConvertQuoteButton } from "@/components/quotes/convert-quote-button";
import { PrintButton } from "@/components/shared/print-button";

export const metadata: Metadata = { title: "Quote" };

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("quotes");
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const client =
    [quote.contact_name, quote.company_name].filter(Boolean).join(" · ") ||
    "No linked client.";
  const title = quote.title || quote.quote_number || "Quote";
  const converted = quote.status === "converted";

  return (
    <>
      <Link
        href="/crm/quotes"
        className="mb-4 inline-block text-sm text-muted underline-offset-2 transition hover:text-navy print:hidden"
      >
        ← Quotes
      </Link>

      {/* Print-only document header. */}
      <div className="mb-8 hidden border-b border-line pb-6 print:block">
        <p className="font-display text-2xl font-light text-navy">
          Elite Events LA
        </p>
        <div className="mt-4 flex justify-between gap-6 text-sm">
          <div>
            <p className="eyebrow">Prepared for</p>
            <p className="mt-1 text-ink">{client}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-light text-navy">
              Quote {quote.quote_number ?? quote.id.slice(0, 8)}
            </p>
            <p className="mt-1 text-muted">
              Valid until {formatDate(quote.valid_until)}
            </p>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          eyebrow="CRM / Quotes"
          title={title}
          description={client}
          action={
            <div className="flex items-center gap-3">
              <QuoteStatusBadge status={quote.status} />
              {!converted && (
                <QuoteStatusControl id={quote.id} status={quote.status} />
              )}
              <PrintButton />
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
                {quote.line_items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No line items.
                    </td>
                  </tr>
                ) : (
                  quote.line_items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-line last:border-b-0"
                    >
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
                    {formatMoney(quote.subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-muted">Tax</dt>
                  <dd className="text-ink tabular-nums">
                    {formatMoney(quote.tax)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line py-2 font-medium">
                  <dt className="text-ink">Total</dt>
                  <dd className="text-navy tabular-nums">
                    {formatMoney(quote.total_amount)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {quote.notes && (
            <div className="rounded-(--radius-card) border border-line bg-card p-6">
              <p className="eyebrow mb-2">Notes</p>
              <p className="whitespace-pre-line text-sm text-ink">
                {quote.notes}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar: meta + actions */}
        <div className="flex flex-col gap-6">
          <div className="rounded-(--radius-card) border border-line bg-card p-6">
            <h2 className="eyebrow mb-3">Details</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Quote #</dt>
                <dd className="text-ink">{quote.quote_number ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Valid until</dt>
                <dd className="text-ink">{formatDate(quote.valid_until)}</dd>
              </div>
              {quote.event_id && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Event</dt>
                  <dd className="text-right">
                    <Link
                      href={`/events/${quote.event_id}`}
                      className="text-navy underline-offset-2 hover:underline"
                    >
                      {quote.event_title ?? "View event"}
                    </Link>
                  </dd>
                </div>
              )}
              {quote.invoice_id && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Invoice</dt>
                  <dd className="text-right">
                    <Link
                      href={`/accounting/invoices/${quote.invoice_id}`}
                      className="text-navy underline-offset-2 hover:underline"
                    >
                      View invoice
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {!converted && (
            <div className="rounded-(--radius-card) border border-line bg-card p-6 print:hidden">
              <h2 className="eyebrow mb-3">Realize</h2>
              {quote.status === "accepted" ? (
                <ConvertQuoteButton id={quote.id} />
              ) : (
                <p className="text-sm text-muted">
                  Mark this quote <span className="text-ink">accepted</span> to
                  convert it into an event and a draft invoice.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
