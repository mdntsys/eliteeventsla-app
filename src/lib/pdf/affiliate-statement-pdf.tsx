import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Renders an affiliate's commission statement as a PDF: their name/rate, rolled-up
 * owed/paid/lifetime totals, the full commission ledger (event, invoice, basis,
 * rate, commission, status), and recorded payouts. Generated on demand from the
 * partner portal.
 */

const NAVY = "#16263a";
const INK = "#22211d";
const MUTED = "#6f6a60";
const LINE = "#ddd7ca";

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },
  brand: { fontSize: 16, color: NAVY, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 15, color: NAVY, marginTop: 2, fontFamily: "Helvetica-Bold" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  metaCell: { width: "50%", marginBottom: 6 },
  metaKey: { fontSize: 8, color: MUTED },
  metaVal: { fontSize: 10, color: INK },
  statRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statVal: { fontSize: 14, color: NAVY, fontFamily: "Helvetica-Bold" },
  statKey: { fontSize: 8, color: MUTED, marginTop: 2 },
  sectionH: {
    fontSize: 10.5,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 4,
  },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 4,
  },
  th: { fontSize: 8, color: MUTED },
  cEvent: { flex: 1, fontSize: 9 },
  cInv: { width: 70, fontSize: 9 },
  cNum: { width: 60, fontSize: 9, textAlign: "right" },
  cRate: { width: 42, fontSize: 9, textAlign: "right" },
  cStatus: { width: 56, fontSize: 9 },
  cDate: { width: 74, fontSize: 9 },
  cMethod: { width: 90, fontSize: 9 },
  empty: { fontSize: 9.5, color: MUTED, marginTop: 4 },
  small: { fontSize: 8.5, color: MUTED, marginTop: 20 },
});

export type StatementCommission = {
  eventTitle: string | null;
  invoiceNumber: string | null;
  basis: number;
  rate: number;
  amount: number;
  status: string;
  earnedAt: string | null;
};

export type StatementPayout = {
  paidAt: string | null;
  amount: number;
  method: string | null;
  reference: string | null;
};

export type StatementPayload = {
  companyName: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  commissionRate: number;
  generatedAt: string;
  totals: { owed: number; paid: number; earned: number };
  commissions: StatementCommission[];
  payouts: StatementPayout[];
};

const STATUS_LABELS: Record<string, string> = {
  accrued: "Accrued",
  paid: "Paid",
  reversed: "Reversed",
};
const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  check: "Check",
  cash: "Cash",
  other: "Other",
};

function usd(n: number | null): string {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function pct(rate: number): string {
  const p = rate * 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaKey}>{k}</Text>
      <Text style={styles.metaVal}>{v}</Text>
    </View>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{v}</Text>
      <Text style={styles.statKey}>{k}</Text>
    </View>
  );
}

function StatementDoc({ payload }: { payload: StatementPayload }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{payload.companyName}</Text>
        <Text style={styles.title}>Commission statement</Text>

        <View style={styles.metaGrid}>
          <Meta k="Partner" v={payload.affiliateName ?? "—"} />
          <Meta k="Email" v={payload.affiliateEmail ?? "—"} />
          <Meta k="Commission rate" v={pct(payload.commissionRate)} />
          <Meta k="Generated" v={fmtDate(payload.generatedAt)} />
        </View>

        <View style={styles.statRow}>
          <Stat k="Owed" v={usd(payload.totals.owed)} />
          <Stat k="Paid out" v={usd(payload.totals.paid)} />
          <Stat k="Lifetime" v={usd(payload.totals.earned)} />
        </View>

        <Text style={styles.sectionH}>Commissions</Text>
        {payload.commissions.length === 0 ? (
          <Text style={styles.empty}>No commissions yet.</Text>
        ) : (
          <>
            <View style={styles.thead}>
              <Text style={[styles.cEvent, styles.th]}>Event</Text>
              <Text style={[styles.cInv, styles.th]}>Invoice</Text>
              <Text style={[styles.cNum, styles.th]}>Basis</Text>
              <Text style={[styles.cRate, styles.th]}>Rate</Text>
              <Text style={[styles.cNum, styles.th]}>Commission</Text>
              <Text style={[styles.cStatus, styles.th]}>Status</Text>
            </View>
            {payload.commissions.map((c, i) => (
              <View style={styles.row} key={i}>
                <Text style={styles.cEvent}>{c.eventTitle ?? "—"}</Text>
                <Text style={styles.cInv}>{c.invoiceNumber ?? "—"}</Text>
                <Text style={styles.cNum}>{usd(c.basis)}</Text>
                <Text style={styles.cRate}>{pct(c.rate)}</Text>
                <Text style={styles.cNum}>{usd(c.amount)}</Text>
                <Text style={styles.cStatus}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionH}>Payouts</Text>
        {payload.payouts.length === 0 ? (
          <Text style={styles.empty}>No payouts recorded yet.</Text>
        ) : (
          <>
            <View style={styles.thead}>
              <Text style={[styles.cDate, styles.th]}>Date</Text>
              <Text style={[styles.cNum, styles.th]}>Amount</Text>
              <Text style={[styles.cMethod, styles.th]}>Method</Text>
              <Text style={[styles.cEvent, styles.th]}>Reference</Text>
            </View>
            {payload.payouts.map((p, i) => (
              <View style={styles.row} key={i}>
                <Text style={styles.cDate}>{fmtDate(p.paidAt)}</Text>
                <Text style={styles.cNum}>{usd(p.amount)}</Text>
                <Text style={styles.cMethod}>
                  {p.method ? (METHOD_LABELS[p.method] ?? p.method) : "—"}
                </Text>
                <Text style={styles.cEvent}>{p.reference ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.small}>
          Commissions are earned on the pre-tax revenue collected once a referred
          invoice is paid in full. This statement reflects the record as of the
          generated date and is not a tax document.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderAffiliateStatementPdf(
  payload: StatementPayload,
): Promise<Buffer> {
  return renderToBuffer(<StatementDoc payload={payload} />);
}
