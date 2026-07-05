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
