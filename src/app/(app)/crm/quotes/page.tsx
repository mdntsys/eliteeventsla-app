import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listContactOptions, listCompanyOptions } from "@/lib/crm/queries";
import { listQuotes } from "@/lib/quotes/queries";
import { formatMoney, formatDate } from "@/lib/accounting/format";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteStatusBadge } from "@/components/quotes/quote-badges";
import { QuoteForm } from "@/components/quotes/quote-form";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage() {
  await requireModule("crm");

  const [rows, contacts, companies] = await Promise.all([
    listQuotes(),
    listContactOptions(),
    listCompanyOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Quotes"
        description="Estimates you send clients — line items and validity. Accept one to convert it into an event and a draft invoice."
        action={<QuoteForm contacts={contacts} companies={companies} />}
      />

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Quote</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Client</span>
                  </th>
                  <th className="px-4 py-3 font-medium text-muted">
                    <span className="eyebrow">Status</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Total</span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    <span className="eyebrow">Valid until</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => {
                  const who =
                    [q.contact_name, q.company_name]
                      .filter(Boolean)
                      .join(" · ") || "—";
                  return (
                    <tr
                      key={q.id}
                      className="border-b border-line transition last:border-b-0 hover:bg-cream"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/crm/quotes/${q.id}`}
                          className="font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {q.title || q.quote_number || "Untitled quote"}
                        </Link>
                        {q.title && q.quote_number && (
                          <span className="ml-2 text-xs text-muted">
                            {q.quote_number}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink">{who}</td>
                      <td className="px-4 py-3">
                        <QuoteStatusBadge status={q.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">
                        {formatMoney(q.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatDate(q.valid_until)}
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

function EmptyState() {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No quotes yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Send your first estimate
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Draft a quote with line items and a validity date. When the client
        accepts, convert it into an event and a draft invoice in one click.
      </p>
    </div>
  );
}
