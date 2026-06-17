import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  await requireModule("crm");
  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Contacts"
        description="People you work with — leads and clients, optionally linked to a company."
      />
      <ModulePlaceholder
        items={[
          "Searchable contact list",
          "Link contact to a company",
          "Contact detail + activity history",
          "Email & phone quick actions",
          "Lead source tracking",
          "Owner assignment",
        ]}
      />
    </>
  );
}
