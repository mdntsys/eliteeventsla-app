/**
 * The affiliate (sales commission) agreement — a single source of the clause
 * text used by BOTH the on-screen signing page and the generated PDF, so what
 * the signer reads is exactly what is executed. Merge fields are resolved from
 * the document payload (name/rate/date auto-filled; the signer only clicks to
 * adopt).
 *
 * NOT LEGAL ADVICE — this is the app's template as approved; have counsel review
 * the final language. Includes the original terms plus the approved protective
 * additions (electronic-signature consent, gross-revenue definition, clawback,
 * W-9/1099, survival, venue, assignment, indemnification).
 */

export const CONTRACT_PAYMENT_DAYS = 30;
export const CONTRACT_GOVERNING_STATE = "California";
export const CONTRACT_VENUE_COUNTY = "Los Angeles County, California";
export const CONTRACT_SURVIVAL_MONTHS = 24;

/** The structured data an affiliate contract renders from (snapshotted). */
export type ContractPayload = {
  representativeName: string;
  email: string | null;
  phone: string | null;
  commissionPct: number;
  effectiveDate: string | null; // ISO date; null until signed (then = sign date)
  companyName: string;
  paymentDays: number;
  governingState: string;
  venueCounty: string;
  survivalMonths: number;
};

export function buildAffiliateContractPayload(a: {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  commission_rate: number;
}): ContractPayload {
  return {
    representativeName: a.full_name ?? "Representative",
    email: a.email,
    phone: a.phone,
    commissionPct: Math.round(a.commission_rate * 100 * 100) / 100,
    effectiveDate: null,
    companyName: "Elite Events LA",
    paymentDays: CONTRACT_PAYMENT_DAYS,
    governingState: CONTRACT_GOVERNING_STATE,
    venueCounty: CONTRACT_VENUE_COUNTY,
    survivalMonths: CONTRACT_SURVIVAL_MONTHS,
  };
}

export type Clause = { heading: string; body: string };

/** The full ordered clause list with merge fields resolved from the payload. */
export function affiliateContractClauses(p: ContractPayload): Clause[] {
  const c = p.companyName;
  return [
    {
      heading: "1. Purpose",
      body: `The Representative will refer potential clients and generate sales leads for ${c}. ${c} agrees to pay commissions on qualified sales in accordance with this Agreement.`,
    },
    {
      heading: "2. Commission",
      body: `The Representative shall receive a commission equal to ${p.commissionPct}% of the gross revenue collected by ${c} from any qualified sale that results directly from the Representative's lead or referral.`,
    },
    {
      heading: "3. Definition of Gross Revenue Collected",
      body: `"Gross revenue collected" means amounts actually received by ${c} for services on a qualified sale, calculated BEFORE any deduction for ${c}'s payment-processing fees, and EXCLUDING sales tax, shipping/third-party pass-through costs, discounts, and any amounts later refunded, charged back, or otherwise returned.`,
    },
    {
      heading: "4. Qualified Sale",
      body: `A qualified sale is a new customer referred by the Representative that signs an agreement with ${c}, pays for services, and whose referral can reasonably be verified by ${c}.`,
    },
    {
      heading: "5. Commission Payment",
      body: `Commission payments will be made within ${p.paymentDays} days after ${c} receives full payment on the qualified sale. No commission is owed on cancelled bookings, refunds, chargebacks, unpaid balances, or unpaid sales.`,
    },
    {
      heading: "6. Clawback",
      body: `If a commission has been paid and the underlying sale is later refunded, charged back, or otherwise reversed, the Representative shall promptly repay the corresponding commission, or ${c} may offset it against future commissions owed.`,
    },
    {
      heading: "7. Independent Relationship & Taxes",
      body: `Unless otherwise agreed in writing, the Representative is an independent referral partner and is solely responsible for all applicable taxes. The Representative shall provide a completed IRS Form W-9 before any payout, and ${c} will issue a Form 1099 as required by law.`,
    },
    {
      heading: "8. Lead Ownership",
      body: `Lead ownership belongs to the first verified referring Representative. ${c} will resolve duplicate claims using its records, and its determination is final.`,
    },
    {
      heading: "9. Confidentiality",
      body: `The Representative agrees to keep confidential all customer information, pricing, business strategies, vendor information, marketing materials, and internal business processes.`,
    },
    {
      heading: "10. Non-Circumvention",
      body: `The Representative agrees not to bypass ${c} or redirect ${c} leads to competitors for personal gain.`,
    },
    {
      heading: "11. Limitation of Authority",
      body: `The Representative may not sign contracts, alter pricing, or bind ${c} without written authorization.`,
    },
    {
      heading: "12. Indemnification",
      body: `The Representative shall indemnify and hold ${c} harmless from any claim, loss, or expense arising out of the Representative's unauthorized representations to referred clients or breach of this Agreement.`,
    },
    {
      heading: "13. Term, Termination & Survival",
      body: `Either party may terminate this Agreement at any time by written notice. Earned commissions prior to termination remain payable. Sections 9 (Confidentiality) and 10 (Non-Circumvention) survive termination for ${p.survivalMonths} months.`,
    },
    {
      heading: "14. Assignment",
      body: `The Representative may not assign this Agreement or any rights under it without ${c}'s prior written consent.`,
    },
    {
      heading: "15. Governing Law & Venue",
      body: `This Agreement is governed by the laws of the State of ${p.governingState}. The exclusive venue for any dispute shall be the state or federal courts located in ${p.venueCounty}.`,
    },
    {
      heading: "16. Electronic Signature & Records Consent",
      body: `The Representative consents to sign this Agreement and to transact electronically, and agrees that their electronic signature, together with the signing record maintained by ${c} (name, email, date and time, IP address, and document fingerprint), constitutes a valid, binding, and admissible original under the federal ESIGN Act and the applicable Uniform Electronic Transactions Act.`,
    },
    {
      heading: "17. Modification & Entire Agreement",
      body: `Any modification must be in writing and agreed by both parties. This document constitutes the entire agreement regarding commission compensation and supersedes any prior understanding.`,
    },
  ];
}

/**
 * A stable, canonical text of the agreement used to compute the tamper-evidence
 * content hash. Includes the resolved clauses + the key merge values, so any
 * later change to terms would change the hash.
 */
export function affiliateContractCanonicalText(p: ContractPayload): string {
  const clauses = affiliateContractClauses(p)
    .map((cl) => `${cl.heading}\n${cl.body}`)
    .join("\n\n");
  return [
    `${p.companyName} — Sales Commission Agreement`,
    `Representative: ${p.representativeName}`,
    `Email: ${p.email ?? ""}`,
    `Phone: ${p.phone ?? ""}`,
    `Commission: ${p.commissionPct}%`,
    `Effective date: ${p.effectiveDate ?? ""}`,
    "",
    clauses,
  ].join("\n");
}
