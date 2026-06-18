import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import {
  listDeals,
  listContactOptions,
  listCompanyOptions,
  listPipelineStages,
} from "@/lib/crm/queries";
import type { DealRow } from "@/lib/crm/types";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { DealForm } from "@/components/crm/deal-form";

export const metadata: Metadata = { title: "Deals" };

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
  });
}

export default async function DealsPage() {
  await requireModule("crm");

  const [deals, contacts, companies, stages] = await Promise.all([
    listDeals(),
    listContactOptions(),
    listCompanyOptions(),
    listPipelineStages(),
  ]);

  const stageOptions = stages.map((s) => ({ id: s.id, label: s.name }));

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Deals"
        description="The full deal list with stage, value, and expected event date — the table view behind the pipeline."
        action={
          <DealForm
            contacts={contacts}
            companies={companies}
            stages={stageOptions}
          />
        }
      />

      {deals.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
          No deals yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Deal</th>
                  <th className="px-4 py-3 font-medium text-muted">Stage</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-muted">
                    Contact / Company
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Value
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted">
                    Event date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deals.map((d: DealRow) => {
                  const who =
                    [d.contact_name, d.company_name]
                      .filter(Boolean)
                      .join(" · ") || "—";
                  return (
                    <tr key={d.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link
                          href={`/crm/deals/${d.id}`}
                          className="font-medium text-navy underline-offset-2 transition hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {d.stage_name ?? (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-3 text-ink">{who}</td>
                      <td className="px-4 py-3 text-right text-ink">
                        {formatMoney(d.estimated_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatDate(d.expected_event_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
