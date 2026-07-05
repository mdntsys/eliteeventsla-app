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
