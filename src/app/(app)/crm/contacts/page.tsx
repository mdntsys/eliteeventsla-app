import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import {
  listContacts,
  listCompanyOptions,
  listStaffOptions,
} from "@/lib/crm/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "@/components/crm/contact-form";
import { ContactsList } from "@/components/crm/contacts-list";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  await requireModule("crm");

  const [rows, companies, staff] = await Promise.all([
    listContacts(),
    listCompanyOptions(),
    listStaffOptions(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Contacts"
        description="People you work with — leads and clients, optionally linked to a company."
        action={<ContactForm companies={companies} staff={staff} />}
      />

      <div className="flex flex-col gap-6">
        {rows.length === 0 ? <EmptyState /> : <ContactsList rows={rows} />}
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No contacts yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Start your contact list
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first lead or client — link them to a company, capture their
        details, then track deals and activity against them.
      </p>
    </div>
  );
}
