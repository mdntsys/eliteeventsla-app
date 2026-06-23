import type { Area } from "@/lib/auth/roles";

/**
 * Each nav ITEM carries its own Area; the sidebar filters items by canView(area)
 * and drops any section left with no visible items. The "Admin" section has no
 * area — it is super-admin-only and gated by is_super_admin in the sidebar.
 */
export type NavItem = { label: string; href: string; area: Area };
export type NavSection = {
  label: string;
  items: NavItem[];
  /** When true, the whole section is shown only to super admins (Team console). */
  superAdminOnly?: boolean;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", area: "dashboard" }],
  },
  {
    label: "CRM",
    items: [
      { label: "Pipeline", href: "/crm", area: "crm" },
      { label: "Contacts", href: "/crm/contacts", area: "crm" },
      { label: "Companies", href: "/crm/companies", area: "crm" },
      { label: "Deals", href: "/crm/deals", area: "crm" },
      { label: "Quotes", href: "/crm/quotes", area: "quotes" },
    ],
  },
  {
    label: "Events",
    items: [{ label: "Events & Jobs", href: "/events", area: "events" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Inventory", href: "/operations/inventory", area: "inventory" },
      {
        label: "Scheduling",
        href: "/operations/scheduling",
        area: "scheduling",
      },
      { label: "Vendors", href: "/operations/vendors", area: "vendors" },
      { label: "Servicing", href: "/operations/servicing", area: "servicing" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Overview", href: "/accounting", area: "accounting" },
      { label: "Invoices", href: "/accounting/invoices", area: "accounting" },
      { label: "Payments", href: "/accounting/payments", area: "accounting" },
    ],
  },
  {
    label: "Admin",
    superAdminOnly: true,
    items: [{ label: "Team", href: "/admin/team", area: "dashboard" }],
  },
];
