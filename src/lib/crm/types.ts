import type { Database } from "@/lib/database.types";

/**
 * Shared types for the CRM module (contacts, companies, deals, pipeline,
 * activities). Row aliases mirror the generated DB shapes; the joined/
 * aggregated view shapes are what the list, detail, and pipeline screens
 * consume.
 */

// --- Row aliases ------------------------------------------------------------

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Deal = Database["public"]["Tables"]["deals"]["Row"];
export type PipelineStage =
  Database["public"]["Tables"]["pipeline_stages"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];

// --- Joined view shapes -----------------------------------------------------

/** An activity joined to its assignee profile. */
export type ActivityView = Activity & { assignee_name: string | null };

/** A row in the contacts list: contact + company name + open deal count. */
export type ContactListRow = Contact & {
  company_name: string | null;
  open_deals: number;
};

/** The full contact detail used by the detail page. */
export type ContactDetail = Contact & {
  company_name: string | null;
  activities: ActivityView[];
  deals: { id: string; title: string; status: string }[];
};

/** A row in the companies list: company + contact and deal counts. */
export type CompanyListRow = Company & {
  contact_count: number;
  deal_count: number;
};

/** The full company detail used by the detail page. */
export type CompanyDetail = Company & {
  contacts: Contact[];
  deals: {
    id: string;
    title: string;
    status: string;
    stage_name: string | null;
  }[];
};

/** A deal row joined to contact, company, and stage names. */
export type DealRow = Deal & {
  contact_name: string | null;
  company_name: string | null;
  stage_name: string | null;
  owner_name: string | null;
};

/** The full deal detail used by the detail page. */
export type DealDetail = DealRow & {
  activities: ActivityView[];
};

/** One column of the pipeline board: a stage and its deals. */
export type PipelineColumn = {
  stage: PipelineStage;
  deals: DealRow[];
};

// --- Form options -----------------------------------------------------------

/** A pickable option for a form select. */
export type Option = { id: string; label: string };

// --- Action state -----------------------------------------------------------

export type ActionState = { error?: string; success?: boolean } | undefined;
