/**
 * Business identity shown on client-facing invoices (the public invoice page,
 * the PDF, and invoice emails). Non-secret; overridable via env so deployment
 * can tweak contact details without a code change.
 */
export const COMPANY = {
  name: "Elite Events LA",
  email: process.env.COMPANY_EMAIL ?? "ops@eliteeventsla.com",
  phone: process.env.COMPANY_PHONE ?? null,
  site: "eliteeventsla.com",
  // Optional postal address (multi-line allowed via \n), e.g. for checks.
  address: process.env.COMPANY_ADDRESS ?? null,
} as const;
