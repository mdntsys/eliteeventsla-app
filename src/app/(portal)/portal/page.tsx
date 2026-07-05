import type { Metadata } from "next";
import { requirePortalAccess } from "@/lib/portal/auth";
import { getAffiliateEarnings } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/accounting/format";

export const metadata: Metadata = { title: "Partner portal" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-card) border border-line bg-card px-4 py-3">
      <p className="font-display text-2xl font-light text-navy">{value}</p>
      <p className="eyebrow mt-0.5">{label}</p>
    </div>
  );
}

export default async function PortalDashboardPage() {
  const { affiliate } = await requirePortalAccess();
  const earnings = await getAffiliateEarnings(affiliate.id);
  const pct = Math.round(affiliate.commission_rate * 10000) / 100;

  return (
    <>
      <PageHeader
        eyebrow="Partner portal"
        title={`Welcome${affiliate.full_name ? `, ${affiliate.full_name}` : ""}`}
        description="Your commissions and payouts at a glance."
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          <Stat label="Owed" value={formatMoney(earnings.owed)} />
          <Stat label="Paid out" value={formatMoney(earnings.paid)} />
          <Stat label="Lifetime" value={formatMoney(earnings.earned)} />
        </div>

        <p className="text-sm text-muted">
          Your commission rate: <span className="text-ink">{pct}%</span>
        </p>
      </div>
    </>
  );
}
