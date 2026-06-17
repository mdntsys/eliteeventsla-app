import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireModule("accounting");
  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Payments"
        description="Payment activity reconciled against jobs — Stripe payment links and their webhook-driven status."
      />
      <ModulePlaceholder
        items={[
          "Payments by status",
          "Create & send Stripe payment links",
          "Webhook-synced status (succeeded/failed/refunded)",
          "Reconcile payment ↔ invoice ↔ event",
          "Method breakdown (card/cash/check/transfer)",
          "Refund tracking",
        ]}
      />
    </>
  );
}
