import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SowPayload } from "@/lib/documents/sow";
import type { ContractSignature } from "@/lib/pdf/contract-pdf";

/**
 * Renders a customer Statement of Work as a PDF: event details, the agreed scope
 * table, notes, and — when signed — the executed signature block plus a
 * Certificate of Completion (audit trail + fingerprint).
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
  sectionH: {
    fontSize: 10.5,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
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
  cDesc: { flex: 1, fontSize: 9.5 },
  cQty: { width: 44, fontSize: 9.5, textAlign: "right" },
  cAmt: { width: 70, fontSize: 9.5, textAlign: "right" },
  th: { fontSize: 8, color: MUTED },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  totalLabel: { fontSize: 10, color: MUTED, marginRight: 12 },
  totalVal: { fontSize: 11, color: NAVY, fontFamily: "Helvetica-Bold" },
  notes: { fontSize: 9.5, marginTop: 8 },
  hr: { borderTopWidth: 1, borderTopColor: LINE, marginVertical: 16 },
  sigRow: { flexDirection: "row", gap: 40, marginTop: 8 },
  sigCol: { flex: 1 },
  sigLabel: { fontSize: 8.5, color: MUTED, marginBottom: 2 },
  sigScript: { fontSize: 15, color: INK, fontFamily: "Helvetica-Oblique" },
  sigLineText: { fontSize: 9.5, color: INK },
  small: { fontSize: 8.5, color: MUTED, marginTop: 16 },
  certTitle: {
    fontSize: 13,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  certRow: { flexDirection: "row", marginTop: 4 },
  certKey: { width: 130, fontSize: 9, color: MUTED },
  certVal: { flex: 1, fontSize: 9, color: INK },
});

function usd(n: number | null): string {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
function fmtDateTimeUTC(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}
function fmtWindow(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  const f = (v: string) =>
    new Date(v).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });
  if (start && end) return `${f(start)} – ${f(end)}`;
  return f((start ?? end) as string);
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaKey}>{k}</Text>
      <Text style={styles.metaVal}>{v}</Text>
    </View>
  );
}

function SowDoc({
  payload,
  signature,
}: {
  payload: SowPayload;
  signature?: ContractSignature;
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{payload.companyName}</Text>
        <Text style={styles.title}>Statement of Work</Text>

        <View style={styles.metaGrid}>
          <Meta k="Event" v={payload.eventTitle} />
          <Meta k="Date" v={fmtDate(payload.eventDate)} />
          <Meta k="Window" v={fmtWindow(payload.startAt, payload.endAt)} />
          <Meta k="Venue" v={payload.venueName ?? "—"} />
          <Meta
            k="Client"
            v={
              [payload.clientName, payload.clientCompany]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
          <Meta
            k="Guests"
            v={payload.guestCount != null ? String(payload.guestCount) : "—"}
          />
        </View>

        <Text style={styles.sectionH}>Scope of work</Text>
        <View style={styles.thead}>
          <Text style={[styles.cDesc, styles.th]}>Description</Text>
          <Text style={[styles.cQty, styles.th]}>Qty</Text>
          <Text style={[styles.cAmt, styles.th]}>Amount</Text>
        </View>
        {payload.scopeItems.map((it, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.cDesc}>{it.description}</Text>
            <Text style={styles.cQty}>{it.quantity}</Text>
            <Text style={styles.cAmt}>{usd(it.amount)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalVal}>{usd(payload.total)}</Text>
        </View>

        {payload.notes ? (
          <>
            <Text style={styles.sectionH}>Notes</Text>
            <Text style={styles.notes}>{payload.notes}</Text>
          </>
        ) : null}

        <View style={styles.hr} />
        <View style={styles.sigRow}>
          <View style={styles.sigCol}>
            <Text style={styles.sigLabel}>CLIENT</Text>
            <Text style={styles.sigScript}>
              {signature ? signature.name : "________________________"}
            </Text>
            <Text style={styles.sigLineText}>
              {payload.clientName ?? "Client"}
            </Text>
            <Text style={styles.sigLineText}>
              Date: {signature ? fmtDate(signature.signedAt) : "____________"}
            </Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={styles.sigLabel}>{payload.companyName.toUpperCase()}</Text>
            <Text style={styles.sigScript}>{payload.companyName}</Text>
            <Text style={styles.sigLineText}>Authorized Representative</Text>
          </View>
        </View>

        {signature ? (
          <Text style={styles.small}>
            Executed electronically. See the attached Certificate of Completion.
            Document ID {signature.documentId}.
          </Text>
        ) : (
          <Text style={styles.small}>Draft — not yet executed.</Text>
        )}
      </Page>

      {signature ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.certTitle}>Certificate of Completion</Text>
          <Text style={styles.cDesc}>
            This Statement of Work was signed electronically. The signing record
            below is maintained by {payload.companyName} as evidence of execution
            under the federal ESIGN Act and the applicable Uniform Electronic
            Transactions Act.
          </Text>
          <View style={{ marginTop: 14 }}>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Document ID</Text>
              <Text style={styles.certVal}>{signature.documentId}</Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Signer</Text>
              <Text style={styles.certVal}>{signature.name}</Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Signer email</Text>
              <Text style={styles.certVal}>{signature.email ?? "—"}</Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Signed at</Text>
              <Text style={styles.certVal}>
                {fmtDateTimeUTC(signature.signedAt)}
              </Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>IP address</Text>
              <Text style={styles.certVal}>{signature.ip ?? "—"}</Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Device</Text>
              <Text style={styles.certVal}>{signature.userAgent ?? "—"}</Text>
            </View>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Content fingerprint</Text>
              <Text style={styles.certVal}>SHA-256 {signature.contentHash}</Text>
            </View>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderSowPdf(
  payload: SowPayload,
  signature?: ContractSignature,
): Promise<Buffer> {
  return renderToBuffer(<SowDoc payload={payload} signature={signature} />);
}
