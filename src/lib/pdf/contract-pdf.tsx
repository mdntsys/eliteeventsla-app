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
  affiliateContractClauses,
  type ContractPayload,
} from "@/lib/documents/contract";

/**
 * Renders the affiliate commission agreement as a PDF. When `signature` is
 * present the executed signature block is filled and a Certificate of
 * Completion page (audit trail + document fingerprint) is appended — this is the
 * legally-defensible executed copy. Elite's side is auto-executed (per the
 * approved one-click flow). Uses only built-in fonts (no asset registration).
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
  meta: { fontSize: 10, color: MUTED, marginTop: 10 },
  metaStrong: { color: INK, fontFamily: "Helvetica-Bold" },
  clauseHeading: {
    fontSize: 10.5,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 2,
  },
  clauseBody: { fontSize: 10 },
  hr: { borderTopWidth: 1, borderTopColor: LINE, marginVertical: 16 },
  sigRow: { flexDirection: "row", gap: 40, marginTop: 8 },
  sigCol: { flex: 1 },
  sigLabel: { fontSize: 8.5, color: MUTED, marginBottom: 2 },
  sigValue: { fontSize: 11, color: INK, fontFamily: "Helvetica-Bold" },
  sigScript: { fontSize: 15, color: INK, fontFamily: "Helvetica-Oblique" },
  sigLineText: { fontSize: 9.5, color: INK },
  certTitle: {
    fontSize: 13,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  certRow: { flexDirection: "row", marginTop: 4 },
  certKey: { width: 130, fontSize: 9, color: MUTED },
  certVal: { flex: 1, fontSize: 9, color: INK },
  small: { fontSize: 8.5, color: MUTED, marginTop: 16 },
});

export type ContractSignature = {
  documentId: string;
  name: string;
  email: string | null;
  signedAt: string; // ISO
  ip: string | null;
  userAgent: string | null;
  contentHash: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "________________";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "________________";
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

function ContractDoc({
  payload,
  signature,
}: {
  payload: ContractPayload;
  signature?: ContractSignature;
}) {
  const clauses = affiliateContractClauses(payload);
  const effective = signature
    ? (payload.effectiveDate ?? signature.signedAt)
    : payload.effectiveDate;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{payload.companyName}</Text>
        <Text style={styles.title}>Sales Commission Agreement</Text>

        <Text style={styles.meta}>
          Effective Date:{" "}
          <Text style={styles.metaStrong}>{fmtDate(effective)}</Text>
        </Text>
        <Text style={styles.meta}>
          Representative:{" "}
          <Text style={styles.metaStrong}>{payload.representativeName}</Text>
          {payload.email ? `   ·   ${payload.email}` : ""}
          {payload.phone ? `   ·   ${payload.phone}` : ""}
        </Text>

        {clauses.map((cl) => (
          <View key={cl.heading} wrap={false}>
            <Text style={styles.clauseHeading}>{cl.heading}</Text>
            <Text style={styles.clauseBody}>{cl.body}</Text>
          </View>
        ))}

        <View style={styles.hr} />

        <View style={styles.sigRow}>
          <View style={styles.sigCol}>
            <Text style={styles.sigLabel}>REPRESENTATIVE</Text>
            <Text style={styles.sigScript}>
              {signature ? signature.name : "________________________"}
            </Text>
            <Text style={styles.sigLineText}>
              {payload.representativeName}
            </Text>
            <Text style={styles.sigLineText}>
              Date: {signature ? fmtDate(signature.signedAt) : "____________"}
            </Text>
          </View>
          <View style={styles.sigCol}>
            <Text style={styles.sigLabel}>{payload.companyName.toUpperCase()}</Text>
            <Text style={styles.sigScript}>{payload.companyName}</Text>
            <Text style={styles.sigLineText}>Authorized Representative</Text>
            <Text style={styles.sigLineText}>
              Date: {signature ? fmtDate(signature.signedAt) : "____________"}
            </Text>
          </View>
        </View>

        {signature ? (
          <Text style={styles.small}>
            Executed electronically. See the attached Certificate of Completion
            for the signing record. Document ID {signature.documentId}.
          </Text>
        ) : (
          <Text style={styles.small}>Draft — not yet executed.</Text>
        )}
      </Page>

      {signature ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.certTitle}>Certificate of Completion</Text>
          <Text style={styles.clauseBody}>
            This document was signed electronically. The signing record below is
            maintained by {payload.companyName} as evidence of execution under
            the federal ESIGN Act and the applicable Uniform Electronic
            Transactions Act.
          </Text>

          <View style={{ marginTop: 14 }}>
            <View style={styles.certRow}>
              <Text style={styles.certKey}>Document</Text>
              <Text style={styles.certVal}>
                {payload.companyName} — Sales Commission Agreement
              </Text>
            </View>
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

          <Text style={styles.small}>
            The content fingerprint is a SHA-256 hash of the exact agreement text
            and terms presented to the signer; any later alteration of the
            document would produce a different fingerprint.
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderAffiliateContractPdf(
  payload: ContractPayload,
  signature?: ContractSignature,
): Promise<Buffer> {
  return renderToBuffer(
    <ContractDoc payload={payload} signature={signature} />,
  );
}
