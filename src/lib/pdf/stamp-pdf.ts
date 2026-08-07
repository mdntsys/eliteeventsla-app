import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { GREAT_VIBES_TTF_BASE64 } from "./fonts/great-vibes-data";

/**
 * Stamp a signature onto an uploaded (externally-authored) PDF and append a
 * Certificate of Completion. This is the counterpart to the @react-pdf renderers
 * (contract-pdf / sow-pdf), which build a PDF from scratch: here we take a
 * finished PDF the app did NOT generate and draw onto it with pdf-lib.
 *
 * Two placement modes:
 *   • spec set  → stamp the typed signature (and date) in place on an existing
 *     page, so it lands in the document's own signature block, e.g. beside a
 *     counterparty who already signed.
 *   • spec null → append a clean signature page (works for any PDF, no
 *     coordinates required).
 *
 * The Certificate of Completion is ALWAYS appended: it carries the tamper-
 * evidence (signer, email, UTC time, IP, device, SHA-256 of the original) that
 * makes the electronic signature defensible, mirroring the generated-PDF flow.
 */

const INK = rgb(0.055, 0.094, 0.157);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.84, 0.85, 0.87);

/** A point on a page — fractions of page width/height (0..1) from the TOP-LEFT. */
export type SigPoint = { x: number; y: number; size: number };

/**
 * Where a signature lands on an uploaded PDF. `page` is 1-based. Stored as
 * `documents.signature_spec`; null means "append a signature page instead".
 */
export type SignatureSpec = {
  page: number;
  name: SigPoint;
  date?: SigPoint;
} | null;

export type SignInfo = {
  documentId: string;
  name: string;
  email: string | null;
  signedAt: string;
  ip: string | null;
  userAgent: string | null;
  contentHash: string;
};

/** MM/DD/YYYY in Pacific — matches how a counterparty hand-dates the page. */
function pacificDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Full Pacific timestamp for the certificate ("Aug 7, 2026, 4:12 PM PDT"). */
function pacificDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/**
 * Keep only characters the PDF standard fonts (WinAnsi) can encode; anything
 * else (emoji, non-Latin scripts) would make pdf-lib throw at draw time.
 */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Greedy wrap that also breaks a single over-long token (a hash, a UA string). */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const widthOf = (s: string) => font.widthOfTextAtSize(s, size);
  const lines: string[] = [];
  let cur = "";
  for (const rawWord of safe(text).split(" ")) {
    let word = rawWord;
    while (widthOf(word) > maxWidth && word.length > 1) {
      let i = 1;
      while (i < word.length && widthOf(word.slice(0, i + 1)) <= maxWidth) i++;
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      lines.push(word.slice(0, i));
      word = word.slice(i);
    }
    const candidate = cur ? `${cur} ${word}` : word;
    if (widthOf(candidate) <= maxWidth) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function stampAndCertifyPdf(
  sourceBytes: Uint8Array,
  spec: SignatureSpec,
  info: SignInfo,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes);
  pdf.registerFontkit(fontkit);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // A script face so the typed signature reads as a signature (close to the
  // handwriting style already on these documents). Subset-embedded to keep the
  // executed PDF small; falls back to oblique if the font can't be embedded.
  let signature: PDFFont;
  try {
    signature = await pdf.embedFont(
      Buffer.from(GREAT_VIBES_TTF_BASE64, "base64"),
      { subset: true },
    );
  } catch {
    signature = await pdf.embedFont(StandardFonts.HelveticaOblique);
  }

  const name = safe(info.name);
  const dateStr = pacificDate(info.signedAt);

  if (spec) {
    const pages = pdf.getPages();
    const idx = Math.min(Math.max((spec.page ?? 1) - 1, 0), pages.length - 1);
    const page = pages[idx];
    const { width, height } = page.getSize();
    page.drawText(name, {
      x: spec.name.x * width,
      y: height - spec.name.y * height,
      size: spec.name.size,
      font: signature,
      color: INK,
    });
    if (spec.date) {
      page.drawText(dateStr, {
        x: spec.date.x * width,
        y: height - spec.date.y * height,
        size: spec.date.size,
        font: helv,
        color: INK,
      });
    }
  } else {
    appendSignaturePage(pdf, { helv, helvBold, signature }, name, info, dateStr);
  }

  appendCertificate(pdf, { helv, helvBold }, info);

  return pdf.save();
}

type Fonts = { helv: PDFFont; helvBold: PDFFont; signature: PDFFont };

function appendSignaturePage(
  pdf: PDFDocument,
  fonts: Fonts,
  name: string,
  info: SignInfo,
  dateStr: string,
): void {
  const page = pdf.addPage();
  const { height } = page.getSize();
  const left = 64;
  let y = height - 96;

  page.drawText("SIGNATURE", {
    x: left,
    y,
    size: 15,
    font: fonts.helvBold,
    color: INK,
  });
  y -= 44;
  page.drawText("Signed by", {
    x: left,
    y,
    size: 9,
    font: fonts.helvBold,
    color: MUTED,
  });
  y -= 26;
  page.drawText(name, { x: left, y, size: 34, font: fonts.signature, color: INK });
  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: left + 300, y },
    thickness: 1,
    color: LINE,
  });
  y -= 24;
  const rows = [
    `Name: ${name}`,
    ...(info.email ? [`Email: ${safe(info.email)}`] : []),
    `Date: ${dateStr}`,
  ];
  for (const row of rows) {
    page.drawText(row, { x: left, y, size: 11, font: fonts.helv, color: INK });
    y -= 18;
  }
}

function appendCertificate(
  pdf: PDFDocument,
  fonts: { helv: PDFFont; helvBold: PDFFont },
  info: SignInfo,
): void {
  const page: PDFPage = pdf.addPage();
  const { width, height } = page.getSize();
  const left = 64;
  const contentWidth = width - left * 2;
  let y = height - 96;

  page.drawText("CERTIFICATE OF COMPLETION", {
    x: left,
    y,
    size: 15,
    font: fonts.helvBold,
    color: INK,
  });
  y -= 20;
  page.drawText("Electronic signature record - Elite Events LA", {
    x: left,
    y,
    size: 10,
    font: fonts.helv,
    color: MUTED,
  });
  y -= 26;
  page.drawLine({
    start: { x: left, y },
    end: { x: width - left, y },
    thickness: 1,
    color: LINE,
  });
  y -= 30;

  const rows: [string, string][] = [
    ["Document ID", info.documentId],
    ["Signer", info.name],
    ["Email", info.email ?? "-"],
    ["Signed at", pacificDateTime(info.signedAt)],
    ["Signed at (UTC)", info.signedAt],
    ["IP address", info.ip ?? "-"],
    ["Device / browser", info.userAgent ?? "-"],
    [
      "Consent",
      "Signer agreed to sign electronically and that their electronic signature is legally binding (ESIGN Act / UETA).",
    ],
  ];
  for (const [label, value] of rows) {
    page.drawText(label, {
      x: left,
      y,
      size: 9,
      font: fonts.helvBold,
      color: MUTED,
    });
    y -= 15;
    for (const line of wrap(value, fonts.helv, 10, contentWidth)) {
      page.drawText(line, { x: left, y, size: 10, font: fonts.helv, color: INK });
      y -= 15;
    }
    y -= 8;
  }

  y -= 4;
  page.drawText("Content fingerprint (SHA-256 of the original document)", {
    x: left,
    y,
    size: 9,
    font: fonts.helvBold,
    color: MUTED,
  });
  y -= 15;
  for (const line of wrap(info.contentHash, fonts.helv, 9, contentWidth)) {
    page.drawText(line, { x: left, y, size: 9, font: fonts.helv, color: INK });
    y -= 13;
  }
}
