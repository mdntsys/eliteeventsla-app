import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  QuoteDetail,
  QuoteLineItem,
  QuoteListRow,
} from "@/lib/quotes/types";

/**
 * Server-only data access for quotes. Reads run under the user's session (RLS:
 * any assigned role can read). Nested joins are cast manually — Supabase's
 * generated embed types are awkward.
 */

function contactName(
  c: { first_name: string | null; last_name: string | null } | null,
): string | null {
  if (!c) return null;
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

export async function listQuotes(): Promise<QuoteListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, contacts(first_name, last_name), companies(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  type Row = QuoteListRow & {
    contacts: { first_name: string | null; last_name: string | null } | null;
    companies: { name: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const { contacts, companies, ...rest } = r;
    return {
      ...rest,
      contact_name: contactName(contacts),
      company_name: companies?.name ?? null,
    };
  });
}

export async function getQuote(id: string): Promise<QuoteDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "*, contacts(first_name, last_name), companies(name), events(title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as typeof data & {
    contacts: { first_name: string | null; last_name: string | null } | null;
    companies: { name: string | null } | null;
    events: { title: string | null } | null;
  };

  const { data: items, error: itemsError } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);

  const { contacts, companies, events, ...rest } = row;
  return {
    ...rest,
    contact_name: contactName(contacts),
    company_name: companies?.name ?? null,
    event_title: events?.title ?? null,
    line_items: (items ?? []) as QuoteLineItem[],
  };
}
