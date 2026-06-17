import type { ModuleKey } from "@/lib/auth/roles";

export type NavItem = { label: string; href: string };
export type NavSection = { label: string; module: ModuleKey; items: NavItem[] };

/** Sidebar structure. Each section is gated by its `module` via canAccess(). */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    module: "dashboard",
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    label: "CRM",
    module: "crm",
    items: [
      { label: "Pipeline", href: "/crm" },
      { label: "Contacts", href: "/crm/contacts" },
      { label: "Companies", href: "/crm/companies" },
      { label: "Deals", href: "/crm/deals" },
    ],
  },
  {
    label: "Events",
    module: "events",
    items: [{ label: "Events & Jobs", href: "/events" }],
  },
  {
    label: "Operations",
    module: "operations",
    items: [
      { label: "Inventory", href: "/operations/inventory" },
      { label: "Scheduling", href: "/operations/scheduling" },
      { label: "Vendors", href: "/operations/vendors" },
      { label: "Servicing", href: "/operations/servicing" },
    ],
  },
  {
    label: "Accounting",
    module: "accounting",
    items: [
      { label: "Overview", href: "/accounting" },
      { label: "Invoices", href: "/accounting/invoices" },
      { label: "Payments", href: "/accounting/payments" },
    ],
  },
  {
    label: "Admin",
    module: "admin",
    items: [{ label: "Team", href: "/admin/team" }],
  },
];
