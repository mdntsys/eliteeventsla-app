import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getAffiliate } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { AffiliateEditForm } from "@/components/affiliates/affiliate-edit-form";

export const metadata: Metadata = { title: "Affiliate" };

function formatPct(rate: number): string {
  const pct = rate * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

function Field({
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

export default async function AffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("affiliates");
  const { id } = await params;

  const affiliate = await getAffiliate(id);
  if (!affiliate) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Partners / Affiliates"
        title={affiliate.full_name ?? "Affiliate"}
        description={affiliate.status === "active" ? "Active" : "Inactive"}
        action={<AffiliateEditForm affiliate={affiliate} />}
      />

      <section className="rounded-(--radius-card) border border-line bg-card p-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email">{affiliate.email ?? "—"}</Field>
          <Field label="Phone">{affiliate.phone ?? "—"}</Field>
          <Field label="Commission rate">
            {formatPct(affiliate.commission_rate)}
          </Field>
          <Field label="Status">
            {affiliate.status === "active" ? "Active" : "Inactive"}
          </Field>
        </div>

        {affiliate.notes && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="eyebrow">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">
              {affiliate.notes}
            </p>
          </div>
        )}
      </section>

      <p className="mt-4 text-sm text-muted">
        Commission earnings, payouts, and their signed agreement appear here once
        those are wired up.
      </p>
    </>
  );
}
