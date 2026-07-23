import type { ReactNode } from "react";
import type { InvoiceStatus, PaymentStatus } from "@/lib/accounting/types";

/** Status pills for invoices and payments (server components). */

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

const INVOICE_STYLES: Record<InvoiceStatus, string> = {
  draft: "border-line bg-cream-deep text-muted",
  sent: "border-line bg-cream-deep text-navy",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
  void: "border-line bg-cream-deep text-muted",
};

const INVOICE_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Pill className={INVOICE_STYLES[status]}>{INVOICE_LABELS[status]}</Pill>;
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  processing: "border-amber-200 bg-amber-50 text-amber-700",
  succeeded: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-line bg-cream-deep text-muted",
  // Muted, not red: an abandoned checkout isn't a failure, it's a non-event.
  cancelled: "border-line bg-cream-deep text-muted",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  succeeded: "Succeeded",
  failed: "Failed",
  refunded: "Refunded",
  cancelled: "Abandoned",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Pill className={PAYMENT_STYLES[status]}>{PAYMENT_LABELS[status]}</Pill>;
}

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank transfer",
  stripe: "Stripe",
};

export function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}
