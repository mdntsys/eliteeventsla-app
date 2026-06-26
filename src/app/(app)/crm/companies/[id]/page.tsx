import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import {
  getCompany,
  listCompanyOptions,
  listStaffOptions,
} from "@/lib/crm/queries";
import type { Contact } from "@/lib/crm/types";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { CompanyForm } from "@/components/crm/company-form";
import { ContactForm } from "@/components/crm/contact-form";

export const metadata: Metadata = { title: "Company" };

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

function contactName(contact: Contact): string {
  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed contact"
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("crm");
  const { id } = await params;

  const [company, companies, staff] = await Promise.all([
    getCompany(id),
    listCompanyOptions(),
    listStaffOptions(),
  ]);
  if (!company) notFound();

  const addressLines = [
    company.address_line1,
    company.address_line2,
    [company.city, company.state, company.postal_code]
      .filter(Boolean)
      .join(", "),
    company.country,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="CRM / Companies"
        title={company.name}
        description={company.industry ?? undefined}
        action={
          <Link
            href="/crm/companies"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All companies
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <p className="eyebrow">Details</p>
            <CompanyForm company={company} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="Industry">
              {company.industry ?? "—"}
            </SummaryField>
            <SummaryField label="Email">
              {company.email ? (
                <a
                  href={`mailto:${company.email}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {company.email}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Phone">
              {company.phone ? (
                <a
                  href={`tel:${company.phone}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {company.phone}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Website">
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Address">
              {addressLines.length ? (
                <span className="whitespace-pre-line">
                  {addressLines.join("\n")}
                </span>
              ) : (
                "—"
              )}
            </SummaryField>
          </div>

          {company.notes && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {company.notes}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-light text-navy">
              Contacts
            </h2>
            <ContactForm
              companies={companies}
              staff={staff}
              defaultCompanyId={company.id}
            />
          </div>

          {company.contacts.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
              No contacts under this company yet.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
              {company.contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex items-start justify-between gap-4 bg-cream px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/crm/contacts/${contact.id}`}
                      className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {contactName(contact)}
                    </Link>
                    {contact.title && (
                      <p className="mt-0.5 text-xs text-muted">
                        {contact.title}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="block text-navy underline-offset-2 hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="block text-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        {contact.phone}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-light text-navy">Deals</h2>
            <span className="eyebrow">
              {company.deals.length}{" "}
              {company.deals.length === 1 ? "deal" : "deals"}
            </span>
          </div>

          {company.deals.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
              No deals tied to this company yet.
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
              {company.deals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex items-center justify-between gap-4 bg-cream px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/crm/deals/${deal.id}`}
                      className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {deal.title}
                    </Link>
                    {deal.stage_name && (
                      <p className="mt-0.5 text-xs text-muted">
                        {deal.stage_name}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={deal.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
