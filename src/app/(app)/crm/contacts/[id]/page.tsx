import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import {
  getContact,
  listCompanyOptions,
  listStaffOptions,
} from "@/lib/crm/queries";
import { mediaReleaseLabel } from "@/lib/documents/sow";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { ContactForm } from "@/components/crm/contact-form";
import { ActivityLog } from "@/components/crm/activity-log";

export const metadata: Metadata = { title: "Contact" };

function formatRecorded(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

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

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("crm");
  const { id } = await params;

  const [contact, companies, staff] = await Promise.all([
    getContact(id),
    listCompanyOptions(),
    listStaffOptions(),
  ]);
  if (!contact) notFound();

  const name =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
    "Unnamed contact";

  return (
    <>
      <PageHeader
        eyebrow="CRM / Contacts"
        title={name}
        description={contact.title ?? undefined}
        action={
          <Link
            href="/crm/contacts"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All contacts
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <p className="eyebrow">Details</p>
            <ContactForm
              contact={contact}
              companies={companies}
              staff={staff}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="Company">
              {contact.company_id && contact.company_name ? (
                <Link
                  href={`/crm/companies/${contact.company_id}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {contact.company_name}
                </Link>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Title">{contact.title ?? "—"}</SummaryField>
            <SummaryField label="Source">{contact.source ?? "—"}</SummaryField>
            <SummaryField label="Email">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {contact.email}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Phone">
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {contact.phone}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Media release">
              {contact.media_release_consent == null ? (
                <span className="text-muted">Not yet answered</span>
              ) : (
                <>
                  <span
                    className={
                      contact.media_release_consent
                        ? "text-green-800"
                        : "text-red-800"
                    }
                  >
                    {mediaReleaseLabel(contact.media_release_consent)}
                  </span>
                  {formatRecorded(contact.media_release_recorded_at) && (
                    <span className="mt-0.5 block text-xs text-muted">
                      Recorded {formatRecorded(contact.media_release_recorded_at)}{" "}
                      from a signed SOW
                    </span>
                  )}
                </>
              )}
            </SummaryField>
          </div>

          {contact.notes && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {contact.notes}
              </p>
            </div>
          )}
        </section>

        <DealsPanel deals={contact.deals} />

        <ActivityLog
          parent={{ kind: "contact", id: contact.id }}
          activities={contact.activities}
          staff={staff}
        />
      </div>
    </>
  );
}

function DealsPanel({
  deals,
}: {
  deals: { id: string; title: string; status: string }[];
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Deals</h2>
        <span className="eyebrow">
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
        </span>
      </div>

      {deals.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          No deals tied to this contact yet.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="flex items-center justify-between gap-4 bg-cream px-4 py-3"
            >
              <Link
                href={`/crm/deals/${deal.id}`}
                className="text-sm font-medium text-navy underline-offset-2 hover:underline"
              >
                {deal.title}
              </Link>
              <StatusBadge status={deal.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
