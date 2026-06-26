import "server-only";

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { PublicInvoice } from "@/lib/invoices/public";
import { COMPANY } from "@/lib/company";
import {
  getPaymentInstructions,
  getPaymentNote,
} from "@/lib/payments/instructions";

const NAVY = "#16263a";
const INK = "#22211d";
const MUTED = "#6f6a60";
const LINE = "#ddd7ca";
const CREAM = "#faf8f3";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Due",
  partial: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.4,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 20, color: NAVY },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 3 },
  invoiceTitle: { fontSize: 18, color: NAVY, textAlign: "right" },
  metaLine: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 2 },
  statusPill: {
    marginTop: 6,
    alignSelf: "flex-end",
    fontSize: 9,
    color: NAVY,
    backgroundColor: CREAM,
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 18 },
  eyebrow: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  billTo: { fontSize: 11, color: INK },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 6,
    marginBottom: 4,
  },
  th: { fontSize: 8, color: MUTED, letterSpacing: 1, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: "right" },
  cUnit: { width: 80, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginTop: 4,
    paddingTop: 6,
  },
  totalLabel: { color: MUTED },
  grand: { color: NAVY, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 26 },
  payMethod: { marginTop: 8 },
  payLabel: { fontSize: 10, color: NAVY, fontFamily: "Helvetica-Bold" },
  payLine: { fontSize: 9, color: INK },
  note: { fontSize: 9, color: MUTED, marginTop: 10 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
  },
});

export function InvoicePdfDoc({ invoice }: { invoice: PublicInvoice }) {
  const number = invoice.invoice_number ?? invoice.id.slice(0, 8);
  const billTo =
    [invoice.client_name, invoice.company_name].filter(Boolean).join(" · ") ||
    "—";
  const methods = getPaymentInstructions();
  const note = getPaymentNote();
  const statusLabel = STATUS_LABEL[invoice.status] ?? invoice.status;

  return (
    <Document title={`Invoice ${number}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{COMPANY.name}</Text>
            <Text style={styles.brandSub}>{COMPANY.site}</Text>
            <Text style={styles.brandSub}>{COMPANY.email}</Text>
            {COMPANY.phone ? (
              <Text style={styles.brandSub}>{COMPANY.phone}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Invoice {number}</Text>
            <Text style={styles.metaLine}>
              Issued {fmtDate(invoice.issued_date)}
            </Text>
            <Text style={styles.metaLine}>Due {fmtDate(invoice.due_date)}</Text>
            <Text style={styles.statusPill}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View>
          <Text style={styles.eyebrow}>Bill to</Text>
          <Text style={styles.billTo}>{billTo}</Text>
          {invoice.client_email ? (
            <Text style={styles.brandSub}>{invoice.client_email}</Text>
          ) : null}
        </View>

        <View style={{ marginTop: 22 }}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.cDesc]}>Description</Text>
            <Text style={[styles.th, styles.cQty]}>Qty</Text>
            <Text style={[styles.th, styles.cUnit]}>Unit price</Text>
            <Text style={[styles.th, styles.cAmt]}>Amount</Text>
          </View>
          {invoice.line_items.length === 0 ? (
            <Text style={{ color: MUTED, paddingVertical: 8 }}>
              No line items.
            </Text>
          ) : (
            invoice.line_items.map((it) => (
              <View key={it.id} style={styles.row} wrap={false}>
                <Text style={styles.cDesc}>{it.description}</Text>
                <Text style={styles.cQty}>{String(it.quantity)}</Text>
                <Text style={styles.cUnit}>{money(it.unit_price)}</Text>
                <Text style={styles.cAmt}>{money(it.amount)}</Text>
              </View>
            ))
          )}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text>{money(invoice.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text>{money(invoice.tax)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalDivider]}>
              <Text style={styles.grand}>Total</Text>
              <Text style={styles.grand}>{money(invoice.total_amount)}</Text>
            </View>
            {invoice.amount_paid > 0 ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Paid</Text>
                  <Text>{money(invoice.amount_paid)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Balance due</Text>
                  <Text>{money(invoice.balance)}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>How to pay</Text>
          <View style={styles.payMethod}>
            <Text style={styles.payLabel}>Card (online)</Text>
            <Text style={styles.payLine}>
              Pay securely by credit or debit card from your invoice page.
            </Text>
          </View>
          {methods.map((m) => (
            <View key={m.label} style={styles.payMethod}>
              <Text style={styles.payLabel}>{m.label}</Text>
              {m.lines.map((line, i) => (
                <Text key={i} style={styles.payLine}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>

        {invoice.notes ? (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Notes</Text>
            <Text style={styles.payLine}>{invoice.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {COMPANY.name} · Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

/** Render an invoice to a PDF Buffer (server-side). */
export async function renderInvoicePdf(invoice: PublicInvoice): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDoc invoice={invoice} />);
}
