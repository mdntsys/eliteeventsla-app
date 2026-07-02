import type { Database } from "@/lib/database.types";

/**
 * Shared types for the servicing module (client service tickets + comment
 * threads). Row aliases mirror the generated DB shapes; the joined/aggregated
 * view shapes are what the queue, detail page, and event-hub panel consume.
 */

// --- Row aliases ------------------------------------------------------------

export type ServiceTicket =
  Database["public"]["Tables"]["service_tickets"]["Row"];
export type TicketComment =
  Database["public"]["Tables"]["ticket_comments"]["Row"];

export type TicketCategory = Database["public"]["Enums"]["ticket_category"];
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];

// --- Joined view shapes -----------------------------------------------------

/** A row in the servicing queue table. */
export type TicketListRow = ServiceTicket & {
  event_title: string | null;
  client_name: string | null;
  assignee_name: string | null;
  comment_count: number;
};

/** A comment in a thread, joined to its author profile. */
export type TicketCommentRow = TicketComment & {
  author_name: string | null;
};

/** The full ticket detail used by the detail page. */
export type TicketDetail = ServiceTicket & {
  event_title: string | null;
  client_name: string | null;
  assignee_name: string | null;
  comments: TicketCommentRow[];
};

/** A ticket as shown in the event-hub servicing panel. */
export type EventTicketRow = ServiceTicket & {
  assignee_name: string | null;
  comment_count: number;
};

// --- Filters & form options -------------------------------------------------

export type TicketFilter = {
  status?: string;
  priority?: string;
  category?: string;
};

export type TicketFormOptions = {
  contacts: { id: string; label: string }[];
  companies: { id: string; label: string }[];
  events: { id: string; title: string }[];
};

// --- Action state -----------------------------------------------------------

export type ActionState = { error?: string; success?: boolean } | undefined;
