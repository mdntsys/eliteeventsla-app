import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  await requireModule("accounting");
  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Invoices"
        description="Invoices tied to events — draft, sent, partial, paid, overdue — with line items and balances."
      />
      <ModulePlaceholder
        items={[
          "Invoice list by status",
          "Line items from event reservations",
          "Subtotal, tax, total, amount paid",
          "Issue & due dates",
          "Send via email (Resend)",
          "Attach a Stripe payment link",
        ]}
      />
    </>
  );
}
