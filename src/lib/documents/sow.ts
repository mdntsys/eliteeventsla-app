/**
 * Statement of Work (customer SOW) model — the structured, immutable payload a
 * SOW document renders from (on-screen, in the signed PDF, and in the content
 * hash). It mirrors the Photo Booth Rental Contract template section-for-section:
 *
 *   1. Parties & Event Overview      — auto-filled from the event/contact
 *   2. Package Inclusions & Hours    — the package name, active-service hours,
 *                                      a list of deliverables, and a setup note
 *   3. Pricing & Payments            — a flat Total Package Cost + a payment
 *                                      structure (pay in full, or a 50% deposit
 *                                      to reserve the date + balance one week out)
 *   4. Terms and Conditions          — static (see sowTermsClauses)
 *   5. Social Media & Media Release  — YES/NO, ELECTED BY THE CLIENT AT SIGNING
 *   6. Signatures & Execution        — handled by the e-sign flow
 *
 * A team member builds sections 1–4 as a draft; the client reviews and, at
 * signing, makes the section-5 election. The executed SOW is the written record.
 */

export type SowScopeItem = {
  description: string;
  quantity: number;
  amount: number;
};

/** One deliverable line under "Package Inclusions" (#2). */
export type SowInclusion = {
  label: string;
  detail: string;
};

/** The booth camera the client booked (#2). */
export type SowCameraType = "standard" | "digital" | "360";

export const CAMERA_TYPES: { value: SowCameraType; label: string }[] = [
  { value: "standard", label: "Standard Camera" },
  { value: "digital", label: "Digital Camera" },
  { value: "360", label: "360 Camera" },
];

/** Display label for a stored camera type (accepts a legacy free-text value). */
export function cameraTypeLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return CAMERA_TYPES.find((c) => c.value === v)?.label ?? v;
}

/** How the total is collected (#3). */
export type SowPaymentStructure = "full" | "split";

export type SowPayload = {
  companyName: string;
  // #1 — Parties & Event Overview
  eventTitle: string;
  eventDate: string | null;
  startAt: string | null;
  endAt: string | null;
  venueName: string | null;
  guestCount: number | null;
  clientName: string | null;
  clientCompany: string | null;
  // #2 — Package Inclusions & Hours of Service
  packageName: string;
  cameraType: SowCameraType | null;
  serviceHours: number | null;
  inclusions: SowInclusion[];
  setupNote: string | null;
  // #3 — Pricing & Payments
  total: number;
  paymentStructure: SowPaymentStructure;
  /** For a split plan: the deposit due up front. Null → derived (half the total). */
  depositAmount: number | null;
  // #5 — Social Media & Media Release (null until the client elects at signing)
  mediaRelease: boolean | null;
  // Misc / legacy
  /** Optional internal itemization. Legacy SOWs stored their scope here. */
  scopeItems?: SowScopeItem[];
  notes: string | null;
};

export const DEFAULT_PACKAGE_NAME = "Standard Booth Package";
export const DEFAULT_SERVICE_HOURS = 3;
export const STANDARD_SETUP_NOTE =
  "Company will arrive 60 minutes prior to the start time for setup. This setup time is not counted against the hours of active service.";

/** The deliverables included in the Standard Booth Package, used to seed a new SOW. */
export function standardBoothInclusions(): SowInclusion[] {
  return [
    { label: "Props", detail: "Standard prop selection." },
    { label: "Backdrop", detail: "Standard backdrop selection." },
    { label: "Media Delivery", detail: "Digital gallery access." },
    { label: "Sharing Features", detail: "Instant text and email sharing." },
    { label: "Prints", detail: "Unlimited photo prints." },
    { label: "Customization", detail: "Choice of print template selection." },
  ];
}

/** Static Terms and Conditions (#4) — identical on every SOW. */
export function sowTermsClauses(): { heading: string; body: string }[] {
  return [
    {
      heading: "Access and Space Requirements",
      body: "The Client must provide a minimum 10' x 10' level area for the booth. A dedicated, standard 3-prong electrical outlet must be located within 20 feet of the setup area.",
    },
    {
      heading: "Outdoor Events",
      body: "If the event is outdoors, the Client must provide adequate shelter (such as a tent or canopy) to protect the equipment from direct sunlight, wind, and rain.",
    },
    {
      heading: "Damage to Equipment",
      body: "The Client accepts full financial responsibility for any damage or loss to the Company's equipment caused by the Client or their event guests.",
    },
    {
      heading: "Liability and Indemnification",
      body: "The Company is not responsible for any personal injury or property damage sustained during the event, unless caused by the direct gross negligence of the Company.",
    },
  ];
}

function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function sowTotal(items: SowScopeItem[]): number {
  return roundMoney(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0));
}

/** The deposit actually due up front on a split plan (explicit, or half the total). */
export function sowDepositAmount(p: SowPayload): number {
  const explicit = p.depositAmount;
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return roundMoney(Math.min(explicit, p.total));
  }
  return roundMoney(p.total / 2);
}

/** The payment schedule rows for #3, derived from the structure + total. */
export function sowPaymentSchedule(
  p: SowPayload,
): { label: string; amount: number; due: string }[] {
  if (p.paymentStructure === "split") {
    const deposit = sowDepositAmount(p);
    const balance = roundMoney(p.total - deposit);
    return [
      {
        label: "Deposit — to reserve your date",
        amount: deposit,
        due: "Due upon signing",
      },
      {
        label: "Remaining balance",
        amount: balance,
        due: "Due one week before the event",
      },
    ];
  }
  return [
    {
      label: "Payment in full",
      amount: roundMoney(p.total),
      due: "Due upon signing to reserve your date",
    },
  ];
}

/** Human-readable media-release status, for the profile and crew views. */
export function mediaReleaseLabel(v: boolean | null | undefined): string {
  if (v == null) return "Not yet answered";
  return v
    ? "Yes — may use & share event media"
    : "No — keep media private";
}

/** Stable canonical text for the tamper-evidence content hash (#6). */
export function sowCanonicalText(p: SowPayload): string {
  const inclusions = (p.inclusions ?? [])
    .map((i) => `- ${i.label}: ${i.detail}`)
    .join("\n");
  const schedule = sowPaymentSchedule(p)
    .map((s) => `${s.label}: $${s.amount.toFixed(2)} (${s.due})`)
    .join("\n");
  const terms = sowTermsClauses()
    .map((c) => `${c.heading}: ${c.body}`)
    .join("\n");
  const media =
    p.mediaRelease == null
      ? "not selected"
      : p.mediaRelease
        ? "YES — media release granted"
        : "NO — media kept private";
  return [
    `${p.companyName} — Photo Booth Rental Contract`,
    "",
    "1. Parties & Event Overview",
    `Client: ${p.clientName ?? ""}${p.clientCompany ? ` (${p.clientCompany})` : ""}`,
    `Event: ${p.eventTitle}`,
    `Date: ${p.eventDate ?? ""}`,
    `Window: ${p.startAt ?? ""} - ${p.endAt ?? ""}`,
    `Venue: ${p.venueName ?? ""}`,
    `Guests: ${p.guestCount ?? ""}`,
    "",
    `2. ${p.packageName || DEFAULT_PACKAGE_NAME} - ${p.serviceHours ?? ""} hours of active service`,
    `Camera / booth: ${cameraTypeLabel(p.cameraType) ?? "—"}`,
    inclusions,
    p.setupNote ? `Note: ${p.setupNote}` : "",
    "",
    "3. Pricing & Payments",
    `Total Package Cost: $${Number(p.total).toFixed(2)}`,
    schedule,
    "",
    "4. Terms and Conditions",
    terms,
    "",
    "5. Social Media & Media Release",
    media,
    "",
    p.notes ? `Notes: ${p.notes}` : "",
  ].join("\n");
}
