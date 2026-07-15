import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  cameraTypeLabel,
  sowPaymentSchedule,
  sowTermsClauses,
  DEFAULT_PACKAGE_NAME,
  type SowPayload,
} from "@/lib/documents/sow";
import type { ContractSignature } from "@/lib/pdf/contract-pdf";

/**
 * Renders a customer Statement of Work (Photo Booth Rental Contract) as a PDF —
 * the six contract sections (overview, package inclusions, pricing + payment
 * schedule, terms, media-release election, signatures) and, when signed, the
 * executed signature block plus a Certificate of Completion (audit trail +
 * fingerprint).
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
  title: {
    fontSize: 15,
    color: NAVY,
    marginTop: 2,
    fontFamily: "Helvetica-Bold",
  },
  intro: { fontSize: 9.5, color: MUTED, marginTop: 8 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  metaCell: { width: "50%", marginBottom: 6 },
  metaKey: { fontSize: 8, color: MUTED },
  metaVal: { fontSize: 10, color: INK },
  sectionH: {
    fontSize: 10.5,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 4,
  },
  body: { fontSize: 9.5 },
  li: { flexDirection: "row", marginTop: 3 },
  liBullet: { width: 12, fontSize: 9.5, color: MUTED },
  liText: { flex: 1, fontSize: 9.5 },
  liLabel: { fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 4,
    marginTop: 2,
  },
  totalLabel: { fontSize: 10, color: MUTED },
  totalVal: { fontSize: 13, color: NAVY, fontFamily: "Helvetica-Bold" },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  payLabel: { fontSize: 9.5, color: INK },
  payDue: { fontSize: 8, color: MUTED },
  payAmt: { fontSize: 9.5, color: INK },
  electionBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    padding: 8,
    fontSize: 9.5,
  },
  notes: { fontSize: 9.5, marginTop: 6 },
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

function Bullet({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.li}>
      <Text style={styles.liBullet}>•</Text>
      <Text style={styles.liText}>
        {label ? <Text style={styles.liLabel}>{label}: </Text> : null}
        {children}
      </Text>
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
  const inclusions = payload.inclusions ?? [];
  const camera = cameraTypeLabel(payload.cameraType);
  const schedule = sowPaymentSchedule(payload);
  const client =
    [payload.clientName, payload.clientCompany].filter(Boolean).join(" · ") ||
    "—";
  const clientParty =
    payload.clientName || payload.clientCompany || "the undersigned Client";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{payload.companyName}</Text>
        <Text style={styles.title}>Photo Booth Rental Contract</Text>

        {/* 1 — Parties & Event Overview */}
        <Text style={styles.sectionH}>1. Parties &amp; Event Overview</Text>
        <Text style={styles.intro}>
          This agreement is made between {payload.companyName} (&quot;Company&quot;)
          and {clientParty} (&quot;Client&quot;).
        </Text>
        <View style={styles.metaGrid}>
          <Meta k="Client" v={client} />
          <Meta k="Event date" v={fmtDate(payload.eventDate)} />
          <Meta k="Event" v={payload.eventTitle} />
          <Meta k="Event location / venue" v={payload.venueName ?? "—"} />
          <Meta k="Window" v={fmtWindow(payload.startAt, payload.endAt)} />
          <Meta
            k="Guests"
            v={payload.guestCount != null ? String(payload.guestCount) : "—"}
          />
        </View>

        {/* 2 — Package Inclusions & Hours of Service */}
        <Text style={styles.sectionH}>
          2. Package Inclusions &amp; Hours of Service
        </Text>
        <Text style={styles.body}>
          The Client is purchasing the{" "}
          {payload.packageName || DEFAULT_PACKAGE_NAME}
          {payload.serviceHours != null
            ? `, which includes ${payload.serviceHours} hours of active service.`
            : "."}
        </Text>
        {camera ? <Bullet label="Camera / booth">{camera}</Bullet> : null}
        {inclusions.map((i, idx) => (
          <Bullet key={idx} label={i.label}>
            {i.detail}
          </Bullet>
        ))}
        {payload.setupNote ? (
          <Text style={[styles.notes, { color: MUTED }]}>
            Note: {payload.setupNote}
          </Text>
        ) : null}

        {/* 3 — Pricing & Payments */}
        <Text style={styles.sectionH}>3. Pricing &amp; Payments</Text>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Package Cost</Text>
          <Text style={styles.totalVal}>{usd(payload.total)}</Text>
        </View>
        {schedule.map((s, i) => (
          <View style={styles.payRow} key={i}>
            <View>
              <Text style={styles.payLabel}>{s.label}</Text>
              <Text style={styles.payDue}>{s.due}</Text>
            </View>
            <Text style={styles.payAmt}>{usd(s.amount)}</Text>
          </View>
        ))}

        {/* 4 — Terms and Conditions */}
        <Text style={styles.sectionH}>4. Terms and Conditions</Text>
        {sowTermsClauses().map((c) => (
          <Bullet key={c.heading} label={c.heading}>
            {c.body}
          </Bullet>
        ))}

        {/* 5 — Social Media & Media Release */}
        <Text style={styles.sectionH}>5. Social Media &amp; Media Release</Text>
        <Text style={styles.body}>
          The Client grants the Company permission to use photos and digital media
          captured during the event for promotional, marketing, and social media
          purposes.
        </Text>
        <View style={styles.electionBox}>
          <Text>
            Client&apos;s election:{" "}
            {payload.mediaRelease == null
              ? "— (not selected)"
              : payload.mediaRelease
                ? "YES — I agree to the media release terms."
                : "NO — I do not agree. Keep our media private."}
          </Text>
        </View>

        {payload.notes ? (
          <>
            <Text style={styles.sectionH}>Notes</Text>
            <Text style={styles.notes}>{payload.notes}</Text>
          </>
        ) : null}

        {/* 6 — Signatures & Execution */}
        <View style={styles.hr} />
        <Text style={styles.sectionH}>6. Signatures &amp; Execution</Text>
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
            <Text style={styles.sigLabel}>
              {payload.companyName.toUpperCase()}
            </Text>
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
          <Text style={styles.body}>
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
              <Text style={styles.certKey}>Media release</Text>
              <Text style={styles.certVal}>
                {payload.mediaRelease == null
                  ? "—"
                  : payload.mediaRelease
                    ? "Granted (YES)"
                    : "Declined (NO)"}
              </Text>
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
