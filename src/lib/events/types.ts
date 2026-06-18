import type { Database } from "@/lib/database.types";

/**
 * Shared types for the event/job operational lifecycle. Row aliases mirror the
 * generated DB shapes; the joined/aggregated view shapes are what the hub page,
 * list, and panels consume.
 */

// --- Row aliases ------------------------------------------------------------

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventItem = Database["public"]["Tables"]["event_items"]["Row"];

/** Slim invoice shape for the event hub's billing-readiness panel. */
export type EventInvoiceRow = {
  id: string;
  invoice_number: string | null;
  status: Database["public"]["Enums"]["invoice_status"];
  total_amount: number;
  amount_paid: number;
  due_date: string | null;
  issued_date: string | null;
};

export type ScheduleEntry =
  Database["public"]["Tables"]["schedule_entries"]["Row"];
export type ScheduleAssignment =
  Database["public"]["Tables"]["schedule_assignments"]["Row"];
export type EventAttachment =
  Database["public"]["Tables"]["event_attachments"]["Row"];

export type EventStatus = Database["public"]["Enums"]["event_status"];
export type EventType = Database["public"]["Enums"]["event_type"];
export type ScheduleType = Database["public"]["Enums"]["schedule_type"];
export type ScheduleStatus = Database["public"]["Enums"]["schedule_status"];
export type ReturnCondition = Database["public"]["Enums"]["return_condition"];

// --- Staff ------------------------------------------------------------------

export type StaffMember = {
  id: string;
  full_name: string | null;
  role: string | null;
};

// --- Joined view shapes -----------------------------------------------------

/** A reserved line item, joined to its inventory item (name/kind) and unit. */
export type EventItemRow = EventItem & {
  item_name: string;
  item_kind: "bulk" | "serialized";
  unit_asset_tag: string | null;
};

/** A staff assignment on a schedule entry, joined to the staff profile. */
export type AssignmentRow = ScheduleAssignment & {
  staff_name: string | null;
  staff_role: string | null;
};

/** A schedule entry plus its (joined) staff assignments. */
export type ScheduleEntryRow = ScheduleEntry & {
  assignments: AssignmentRow[];
};

/** An attachment with a short-lived signed URL for the private bucket. */
export type AttachmentRow = EventAttachment & {
  signed_url: string | null;
};

/** A row in the events list table. */
export type EventListRow = EventRow & {
  client_name: string | null;
  company_name: string | null;
  item_count: number;
  next_schedule_at: string | null;
};

/** The full event detail used by the command-center hub page. */
export type EventDetail = EventRow & {
  client_name: string | null;
  company_name: string | null;
  items: EventItemRow[];
  schedule: ScheduleEntryRow[];
  attachments: AttachmentRow[];
};

// --- Availability -----------------------------------------------------------

export type AvailabilityUnit = {
  unit_id: string;
  asset_tag: string | null;
  available: boolean;
  conflict_event_id: string | null;
  conflict_event_title: string | null;
};

export type Availability = {
  kind: "bulk" | "serialized";
  total: number;
  reserved: number;
  available: number;
  units: AvailabilityUnit[];
};

// --- Action state -----------------------------------------------------------

export type ActionState = { error?: string; success?: boolean } | undefined;
