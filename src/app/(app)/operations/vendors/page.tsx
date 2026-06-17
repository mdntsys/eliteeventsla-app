import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  await requireModule("operations");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Vendors"
        description="The external vendor network — food, drink, catering, entertainment and more — and which vendors are tied to which events."
      />
      <ModulePlaceholder
        items={[
          "Vendor directory by category",
          "Contacts, website, ratings",
          "Preferred-vendor flags",
          "Vendors attached to events",
          "Agreed cost & confirmation status",
          "Notes & performance history",
        ]}
      />
    </>
  );
}
