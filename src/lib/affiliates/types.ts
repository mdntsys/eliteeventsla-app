import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];

export type Affiliate = Tables["affiliates"]["Row"];
export type AffiliateStatus = Database["public"]["Enums"]["affiliate_status"];

/** A simple {id,label} option for a <select>. */
export type Option = { id: string; label: string };

/** Standard accounting/crm-style action result shape. */
export type ActionState =
  | { error?: string; success?: boolean; notice?: string }
  | undefined;

/** An affiliate joined to its login profile (name/email/phone). */
export type AffiliateRow = Affiliate & {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

export type AffiliateCommission = Tables["affiliate_commissions"]["Row"];
export type AffiliatePayout = Tables["affiliate_payouts"]["Row"];
export type CommissionStatus =
  Database["public"]["Enums"]["commission_status"];

/** A commission joined to its event title + invoice number, for display. */
export type CommissionRow = AffiliateCommission & {
  event_title: string | null;
  invoice_number: string | null;
};

/** Rolled-up commission totals for an affiliate (all in dollars). */
export type AffiliateEarnings = {
  /** Lifetime earned (accrued + paid; reversed excluded). */
  earned: number;
  /** Already paid out. */
  paid: number;
  /** Accrued but not yet paid (what's owed). */
  owed: number;
  /** How many commissions are currently accrued/unpaid. */
  accruedCount: number;
};

/** One of an event's commissions, joined to its invoice number, for display. */
export type EventCommissionRow = {
  id: string;
  invoice_number: string | null;
  amount: number;
  rate: number;
  status: CommissionStatus;
};

/**
 * An event's affiliate attribution + this event's commission rollup — the data
 * behind the event hub's "Affiliate & commission" panel. All rates are stored
 * fractions (0–1); all amounts are dollars.
 */
export type EventAffiliateSummary = {
  affiliateId: string | null;
  affiliateName: string | null;
  affiliateStatus: AffiliateStatus | null;
  /** The affiliate's own default rate; null when unattributed. */
  defaultRate: number | null;
  /** The event's per-event override; null when none is set. */
  overrideRate: number | null;
  /** override ?? default; null when unattributed. */
  effectiveRate: number | null;
  /** This event's commissions rolled up by status (dollars) + the rows. */
  commission: {
    accrued: number;
    paid: number;
    reversed: number;
    rows: EventCommissionRow[];
  };
};
