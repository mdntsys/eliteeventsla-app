import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];

export type Quote = Tables["quotes"]["Row"];
export type QuoteLineItem = Tables["quote_line_items"]["Row"];
export type QuoteStatus = Database["public"]["Enums"]["quote_status"];

/** {id,label} option for a <select>. */
export type Option = { id: string; label: string };

export type ActionState = { error?: string; success?: boolean } | undefined;

/** A line the create-quote form submits (as JSON) before amounts are computed. */
export type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

export type QuoteListRow = Quote & {
  contact_name: string | null;
  company_name: string | null;
};

export type QuoteDetail = QuoteListRow & {
  event_title: string | null;
  line_items: QuoteLineItem[];
};
