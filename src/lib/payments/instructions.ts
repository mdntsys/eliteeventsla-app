import "server-only";

/**
 * Global, company-wide alternative payment instructions shown on the public
 * invoice page and PDF (Zelle / wire / check). Configured via server-only env
 * vars so bank details never live in the repo. A method appears only if its env
 * var is set; with none set, the invoice simply offers card payment. Multi-line
 * details use "\n" (literal) or real newlines.
 */

export type PaymentInstruction = { label: string; lines: string[] };

function splitLines(v: string): string[] {
  return v
    .split(/\\n|\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function getPaymentInstructions(): PaymentInstruction[] {
  const out: PaymentInstruction[] = [];
  const zelle = process.env.PAYMENT_ZELLE?.trim();
  const wire = process.env.PAYMENT_WIRE?.trim();
  const check = process.env.PAYMENT_CHECK?.trim();
  if (zelle) out.push({ label: "Zelle", lines: splitLines(zelle) });
  if (wire) out.push({ label: "Wire / ACH", lines: splitLines(wire) });
  if (check) out.push({ label: "Check", lines: splitLines(check) });
  return out;
}

/** Optional one-line note appended under the payment methods (e.g. "include your invoice number"). */
export function getPaymentNote(): string | null {
  return process.env.PAYMENT_INSTRUCTIONS_NOTE?.trim() || null;
}
