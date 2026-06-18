import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type Invoice = Tables["invoices"]["Row"];
export type InvoiceLineItem = Tables["invoice_line_items"]["Row"];
export type Payment = Tables["payments"]["Row"];

export type InvoiceStatus = Enums["invoice_status"];
export type PaymentMethod = Enums["payment_method"];
export type PaymentStatus = Enums["payment_status"];

/** A simple {id,label} option for a <select>. */
export type Option = { id: string; label: string };

/**
 * The result shape returned by every accounting server action. `url` carries a
 * freshly-created Stripe payment link; `stripeUnconfigured` lets the UI render a
 * "Connect Stripe" state instead of an error when the secret key is absent.
 */
export type ActionState =
  | {
      error?: string;
      success?: boolean;
      url?: string;
      stripeUnconfigured?: boolean;
    }
  | undefined;

/** A line the create-invoice form submits (as JSON) before amounts are computed. */
export type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type InvoiceListRow = Invoice & {
  contact_name: string | null;
  company_name: string | null;
  event_title: string | null;
};

export type InvoiceDetail = InvoiceListRow & {
  line_items: InvoiceLineItem[];
  payments: Payment[];
};

export type PaymentListRow = Payment & {
  invoice_number: string | null;
  event_title: string | null;
};

export type AccountingOverview = {
  outstanding: number;
  paidTotal: number;
  overdueAmount: number;
  overdueCount: number;
  draftCount: number;
  openCount: number;
  invoiceCount: number;
  recentPayments: PaymentListRow[];
};
