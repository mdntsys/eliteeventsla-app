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

/** Per-event payment rollup, for at-a-glance scanning in the events list. */
export type EventPaymentState = "unbilled" | "unpaid" | "partial" | "paid";

/** A row in the events list table. */
export type EventListRow = EventRow & {
  client_name: string | null;
  company_name: string | null;
  item_count: number;
  next_schedule_at: string | null;
  /** Sum of non-void invoice totals billed to this event. */
  invoiced: number;
  /** Sum of amount_paid across this event's non-void invoices. */
  paid: number;
  /** Derived payment standing for the badge. */
  payment_state: EventPaymentState;
};

/** The full event detail used by the command-center hub page. */
export type EventDetail = EventRow & {
  client_name: string | null;
  company_name: string | null;
  /** The client's signed-SOW media-release election (null = not on file). */
  contact_media_release: boolean | null;
  items: EventItemRow[];
  schedule: ScheduleEntryRow[];
  attachments: AttachmentRow[];
};

// --- Reserve-from-inventory picker ------------------------------------------

/** An event offered in the inventory tab's "reserve for an event" picker. */
export type EventOption = {
  id: string;
  label: string;
  /** Default reserve window (YYYY-MM-DD, "" when unknown) for the form inputs. */
  defaultFrom: string;
  defaultTo: string;
};

// --- Pick list --------------------------------------------------------------

/** A single line on a per-event pick list. */
export type PickListLine = {
  name: string;
  kind: "bulk" | "serialized";
  /** "×3" for bulk, the unit asset tag (or "Any available unit") for serialized. */
  detail: string;
  section: string | null;
};

/** Pick-list lines grouped by the physical location they're pulled from. */
export type PickListGroup = {
  location: string;
  lines: PickListLine[];
};

/** The full pick-list dataset for one event. */
export type EventPickList = {
  event: {
    id: string;
    title: string;
    event_date: string | null;
    venue_name: string | null;
    window: string | null;
  };
  groups: PickListGroup[];
  totalLines: number;
  totalUnits: number;
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

export type ActionState =
  | {
      error?: string;
      success?: boolean;
      /**
       * A partial success worth showing: reserving a bundle books whatever is
       * free and reports what it couldn't get, rather than failing outright.
       */
      warning?: string;
    }
  | undefined;
