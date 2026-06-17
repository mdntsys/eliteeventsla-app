import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  EventVendor,
  EventVendorRow,
  Vendor,
  VendorCategory,
  VendorDetail,
  VendorEventRow,
  VendorListRow,
  VendorOption,
} from "@/lib/vendors/types";

/** All vendor categories, alphabetical. */
export async function listVendorCategories(): Promise<VendorCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The vendor directory: every vendor with its category name and a count of the
 * events it is tied to. Optionally filtered by category_id. Preferred vendors
 * sort first, then alphabetically by name.
 */
export async function listVendors(
  categoryId?: string,
): Promise<VendorListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("vendors")
    .select("*, vendor_categories(name), event_vendors(id)")
    .order("preferred", { ascending: false })
    .order("name", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type VendorWithJoins = Vendor & {
    vendor_categories: { name: string } | null;
    event_vendors: { id: string }[] | null;
  };

  const vendors = (data ?? []) as VendorWithJoins[];

  return vendors.map((vendor) => {
    const { vendor_categories, event_vendors, ...rest } = vendor;
    return {
      ...rest,
      category_name: vendor_categories?.name ?? null,
      event_count: event_vendors?.length ?? 0,
    };
  });
}

/**
 * A single vendor with its category name and the events it is tied to
 * (event_vendors joined to the event title/date/status), newest event first.
 * Returns null if the vendor does not exist (or is not visible under RLS).
 */
export async function getVendor(id: string): Promise<VendorDetail | null> {
  const supabase = await createClient();

  const { data: vendorData, error: vendorError } = await supabase
    .from("vendors")
    .select("*, vendor_categories(name)")
    .eq("id", id)
    .maybeSingle();

  if (vendorError) throw new Error(vendorError.message);
  if (!vendorData) return null;

  const { vendor_categories, ...vendor } = vendorData as Vendor & {
    vendor_categories: { name: string } | null;
  };

  const { data: linkData, error: linkError } = await supabase
    .from("event_vendors")
    .select("*, events(title, event_date, status, created_at)")
    .eq("vendor_id", id);

  if (linkError) throw new Error(linkError.message);

  type LinkWithEvent = EventVendor & {
    events: {
      title: string;
      event_date: string | null;
      status: string;
      created_at: string;
    } | null;
  };

  const links = (linkData ?? []) as LinkWithEvent[];

  const events: VendorEventRow[] = links
    .map((link) => {
      const { events: ev, ...rest } = link;
      return {
        row: {
          ...rest,
          event_title: ev?.title ?? "Untitled event",
          event_date: ev?.event_date ?? null,
          event_status: ev?.status ?? "",
        } satisfies VendorEventRow,
        // Sort key: prefer the event's date, fall back to the link's created_at.
        sortKey: ev?.created_at ?? rest.created_at,
      };
    })
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))
    .map((x) => x.row);

  return {
    ...vendor,
    category_name: vendor_categories?.name ?? null,
    events,
  };
}

/**
 * The vendors tied to one event, joined to vendor name + category, for the
 * Event hub panel. Newest link first.
 */
export async function listEventVendors(
  eventId: string,
): Promise<EventVendorRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_vendors")
    .select("*, vendors(name, vendor_categories(name))")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type LinkWithVendor = EventVendor & {
    vendors: {
      name: string;
      vendor_categories: { name: string } | null;
    } | null;
  };

  const links = (data ?? []) as LinkWithVendor[];

  return links.map((link) => {
    const { vendors, ...rest } = link;
    return {
      ...rest,
      vendor_name: vendors?.name ?? "Unknown vendor",
      vendor_category: vendors?.vendor_categories?.name ?? null,
    };
  });
}

/**
 * Active vendors as pickable options for the add-to-event control,
 * alphabetical by name.
 */
export async function listVendorsForPicker(): Promise<VendorOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, vendor_categories(name)")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  type PickerRow = {
    id: string;
    name: string;
    vendor_categories: { name: string } | null;
  };

  const vendors = (data ?? []) as PickerRow[];

  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    category_name: v.vendor_categories?.name ?? null,
  }));
}
