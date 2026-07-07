import "server-only";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { EventPickList } from "@/lib/events/types";

/**
 * Renders a warehouse pick list for one event as a PDF: the reserved gear
 * grouped by the location it's pulled from, each line with a check box, the
 * unit asset tag or quantity, and its section. Built for the crew to walk the
 * warehouse and load out.
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
  counts: { fontSize: 9, color: MUTED, marginTop: 6 },
  groupH: {
    fontSize: 11,
    color: NAVY,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 5,
  },
  checkbox: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: MUTED,
    borderRadius: 2,
    marginRight: 10,
  },
  cName: { flex: 1, fontSize: 10 },
  cDetail: { width: 120, fontSize: 10, textAlign: "right" },
  cSection: { width: 70, fontSize: 9, color: MUTED, textAlign: "right" },
  empty: { fontSize: 9.5, color: MUTED, marginTop: 8 },
  small: { fontSize: 8.5, color: MUTED, marginTop: 24 },
});

export type PickListPayload = {
  companyName: string;
  generatedAt: string;
  pickList: EventPickList;
};

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

function fmtEventDate(value: string | null): string {
  if (!value) return "Date TBD";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
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

function PickListDoc({ payload }: { payload: PickListPayload }) {
  const { pickList } = payload;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>{payload.companyName}</Text>
        <Text style={styles.title}>Pick list — {pickList.event.title}</Text>

        <View style={styles.metaGrid}>
          <Meta k="Event date" v={fmtEventDate(pickList.event.event_date)} />
          <Meta k="Venue" v={pickList.event.venue_name ?? "—"} />
          {pickList.event.window ? (
            <Meta k="Reserve window" v={pickList.event.window} />
          ) : null}
          <Meta k="Generated" v={fmtDate(payload.generatedAt)} />
        </View>
        <Text style={styles.counts}>
          {pickList.totalLines} line{pickList.totalLines === 1 ? "" : "s"} ·{" "}
          {pickList.totalUnits} unit{pickList.totalUnits === 1 ? "" : "s"} to
          pull
        </Text>

        {pickList.groups.length === 0 ? (
          <Text style={styles.empty}>
            No gear is reserved for this event yet.
          </Text>
        ) : (
          pickList.groups.map((group, gi) => (
            <View key={gi} wrap={false}>
              <Text style={styles.groupH}>{group.location}</Text>
              {group.lines.map((line, li) => (
                <View style={styles.row} key={li}>
                  <View style={styles.checkbox} />
                  <Text style={styles.cName}>{line.name}</Text>
                  <Text style={styles.cDetail}>{line.detail}</Text>
                  <Text style={styles.cSection}>
                    {line.section ? `§${line.section}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        <Text style={styles.small}>
          Check each item as it is pulled and staged. Serialized items list the
          exact asset tag to grab; bulk items show the quantity.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPickListPdf(
  payload: PickListPayload,
): Promise<Buffer> {
  return renderToBuffer(<PickListDoc payload={payload} />);
}
