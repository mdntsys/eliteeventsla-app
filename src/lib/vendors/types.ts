import type { Database } from "@/lib/database.types";

/**
 * Shared vendor types. These mirror the generated DB row shapes and add the
 * aggregated/joined view shapes used by the directory, detail, and event-hub
 * screens.
 */

export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type VendorCategory =
  Database["public"]["Tables"]["vendor_categories"]["Row"];
export type EventVendor =
  Database["public"]["Tables"]["event_vendors"]["Row"];

/** A row in the vendor directory: vendor + category name + how many events. */
export type VendorListRow = Vendor & {
  category_name: string | null;
  event_count: number;
};

/** An event_vendors row as seen from a vendor's detail page (joined event). */
export type VendorEventRow = EventVendor & {
  event_title: string;
  event_date: string | null;
  event_status: string;
};

/** A single vendor with its category name and the events it is tied to. */
export type VendorDetail = Vendor & {
  category_name: string | null;
  events: VendorEventRow[];
};

/** An event_vendors row as seen from the Event hub (joined vendor). */
export type EventVendorRow = EventVendor & {
  vendor_name: string;
  vendor_category: string | null;
};

/** A pickable vendor for the add-to-event control. */
export type VendorOption = {
  id: string;
  name: string;
  category_name: string | null;
};

/** Return shape for every server action (useActionState compatible). */
export type ActionState = { error?: string; success?: boolean } | undefined;
