import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import {
  getDeal,
  listContactOptions,
  listCompanyOptions,
  listPipelineStages,
  listStaffOptions,
  listAdminOptions,
} from "@/lib/crm/queries";
import { listAffiliateOptions } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { DealForm } from "@/components/crm/deal-form";
import { DealStageControl } from "@/components/crm/deal-stage-control";
import { ActivityLog } from "@/components/crm/activity-log";

export const metadata: Metadata = { title: "Deal" };

const EVENT_TYPE_LABELS: Record<string, string> = {
  corporate: "Corporate",
  wedding: "Wedding",
  personal: "Personal",
  other: "Other",
};

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    // Date-only columns (expected_event_date, follow_up_date) parse as UTC
    // midnight — format in UTC so they don't render a day early west of UTC.
    timeZone: "UTC",
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

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("crm");
  const { id } = await params;

  const [deal, contacts, companies, stages, staff, admins, affiliates] =
    await Promise.all([
      getDeal(id),
      listContactOptions(),
      listCompanyOptions(),
      listPipelineStages(),
      listStaffOptions(),
      listAdminOptions(),
      listAffiliateOptions(),
    ]);

  if (!deal) notFound();

  const stageOptions = stages.map((s) => ({ id: s.id, label: s.name }));

  return (
    <>
      <PageHeader
        eyebrow="CRM / Deals"
        title={deal.title}
        description={deal.stage_name ?? undefined}
        action={
          <Link
            href="/crm/deals"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            All deals
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <StatusBadge status={deal.status} />
            {deal.stage_name && (
              <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
                {deal.stage_name}
              </span>
            )}
            {deal.event_type && (
              <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
                {EVENT_TYPE_LABELS[deal.event_type] ?? deal.event_type}
              </span>
            )}
          </div>

          {deal.notes && (
            <p className="mb-6 whitespace-pre-line text-sm text-ink">
              {deal.notes}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryField label="Contact">
              {deal.contact_id ? (
                <Link
                  href={`/crm/contacts/${deal.contact_id}`}
                  className="text-navy underline-offset-2 transition hover:underline"
                >
                  {deal.contact_name ?? "View contact"}
                </Link>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Company">
              {deal.company_id ? (
                <Link
                  href={`/crm/companies/${deal.company_id}`}
                  className="text-navy underline-offset-2 transition hover:underline"
                >
                  {deal.company_name ?? "View company"}
                </Link>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Estimated value">
              {formatMoney(deal.estimated_value)}
            </SummaryField>
            <SummaryField label="Expected event date">
              {formatDate(deal.expected_event_date)}
            </SummaryField>
            <SummaryField label="Lead owner">
              {deal.owner_name ?? "Unassigned"}
            </SummaryField>
            <SummaryField label="Follow-up due">
              {formatDate(deal.follow_up_date)}
            </SummaryField>
            {deal.source && (
              <SummaryField label="Source">{deal.source}</SummaryField>
            )}
          </div>

          <DealForm
            deal={deal}
            contacts={contacts}
            companies={companies}
            stages={stageOptions}
            admins={admins}
            affiliates={affiliates}
          />
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <p className="eyebrow mb-4">Stage &amp; conversion</p>
          <DealStageControl
            dealId={deal.id}
            stageId={deal.stage_id}
            stages={stageOptions}
          />
        </section>

        <ActivityLog
          parent={{ kind: "deal", id: deal.id }}
          activities={deal.activities}
          staff={staff}
        />
      </div>
    </>
  );
}
