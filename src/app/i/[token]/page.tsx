import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvoiceByToken } from "@/lib/invoices/public";
import { formatMoney, formatDate } from "@/lib/accounting/format";
import {
  getPaymentInstructions,
  getPaymentNote,
} from "@/lib/payments/instructions";
import { COMPANY } from "@/lib/company";

// Always render fresh — invoice status/balance must never be stale-cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-line bg-cream text-muted" },
  sent: { label: "Due", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  partial: {
    label: "Partially paid",
    cls: "border-amber-300 bg-amber-50 text-amber-800",
  },
  paid: { label: "Paid", cls: "border-green-300 bg-green-50 text-green-700" },
  overdue: { label: "Overdue", cls: "border-red-300 bg-red-50 text-red-700" },
  void: { label: "Void", cls: "border-line bg-cream text-muted" },
};

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; error?: string }>;
}) {
  const { token } = await params;
  const { paid, error } = await searchParams;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) notFound();

  const methods = getPaymentInstructions();
  const note = getPaymentNote();
  const status = STATUS[invoice.status] ?? {
    label: invoice.status,
    cls: "border-line bg-cream text-muted",
  };
  const billTo =
    [invoice.client_name, invoice.company_name].filter(Boolean).join(" · ") ||
    "—";
  const canPay =
    invoice.balance > 0 &&
    invoice.status !== "void" &&
    invoice.status !== "paid";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      {paid && (
        <div className="mb-6 rounded-(--radius-card) border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Thank you — your payment was received. A receipt is on its way; this
          page will reflect the update shortly.
        </div>
      )}
      {error === "checkout" && (
        <div className="mb-6 rounded-(--radius-card) border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          We couldn’t start checkout just now. Please try again, or use one of
          the other payment options below.
        </div>
      )}

      <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-6 sm:p-8">
          <div>
            <p className="font-display text-3xl font-light text-navy">
              {COMPANY.name}
            </p>
            <p className="mt-1 text-sm text-muted">{COMPANY.site}</p>
            <a
              href={`mailto:${COMPANY.email}`}
              className="text-sm text-muted underline-offset-2 hover:underline"
            >
              {COMPANY.email}
            </a>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-light text-navy">
              Invoice {invoice.invoice_number ?? invoice.id.slice(0, 8)}
            </p>
            <p className="mt-1 text-xs text-muted">
              Issued {formatDate(invoice.issued_date)} · Due{" "}
              {formatDate(invoice.due_date)}
            </p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <p className="eyebrow">Bill to</p>
          <p className="mt-1 text-ink">{billTo}</p>
          {invoice.client_email && (
            <p className="text-sm text-muted">{invoice.client_email}</p>
          )}

          {/* Line items */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 pr-3">
                    <span className="eyebrow">Description</span>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <span className="eyebrow">Qty</span>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <span className="eyebrow">Unit</span>
                  </th>
                  <th className="py-2 pl-3 text-right">
                    <span className="eyebrow">Amount</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      No line items.
                    </td>
                  </tr>
                ) : (
                  invoice.line_items.map((it) => (
                    <tr key={it.id} className="border-b border-line">
                      <td className="py-3 pr-3 text-ink">{it.description}</td>
                      <td className="py-3 px-3 text-right text-muted tabular-nums">
                        {it.quantity}
                      </td>
                      <td className="py-3 px-3 text-right text-muted tabular-nums">
                        {formatMoney(it.unit_price)}
                      </td>
                      <td className="py-3 pl-3 text-right text-ink tabular-nums">
                        {formatMoney(it.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 ml-auto w-full max-w-xs text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted">Subtotal</span>
              <span className="text-ink tabular-nums">
                {formatMoney(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted">Tax</span>
              <span className="text-ink tabular-nums">
                {formatMoney(invoice.tax)}
              </span>
            </div>
            <div className="flex justify-between border-t border-line py-2 font-medium">
              <span className="text-ink">Total</span>
              <span className="text-navy tabular-nums">
                {formatMoney(invoice.total_amount)}
              </span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Paid</span>
                  <span className="text-ink tabular-nums">
                    {formatMoney(invoice.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span className="text-ink">Balance due</span>
                  <span className="text-navy tabular-nums">
                    {formatMoney(invoice.balance)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Pay by card */}
          {canPay && (
            <form
              method="POST"
              action={`/api/invoice/${invoice.public_token}/checkout`}
              className="mt-8"
            >
              <button
                type="submit"
                className="w-full rounded-(--radius-card) bg-navy px-4 py-3 text-sm font-medium text-cream transition hover:opacity-90 sm:w-auto"
              >
                Pay {formatMoney(invoice.balance)} by card →
              </button>
              <p className="mt-2 text-xs text-muted">
                Secure card payment powered by Stripe.
              </p>
            </form>
          )}

          {/* Other payment options */}
          {(methods.length > 0 || note) && (
            <div className="mt-8 border-t border-line pt-6">
              <p className="eyebrow">Other ways to pay</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {methods.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-(--radius-card) border border-line bg-cream/50 p-4"
                  >
                    <p className="text-sm font-medium text-navy">{m.label}</p>
                    {m.lines.map((line, i) => (
                      <p key={i} className="text-sm text-ink">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              {note && <p className="mt-3 text-xs text-muted">{note}</p>}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-6 border-t border-line pt-4">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* PDF */}
          <div className="mt-8 border-t border-line pt-6">
            <a
              href={`/api/invoice/${invoice.public_token}/pdf`}
              className="text-sm text-navy underline underline-offset-2"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Questions? Reply to your invoice email or contact {COMPANY.email}.
      </p>
    </main>
  );
}
