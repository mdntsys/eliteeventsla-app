import { formatMoney } from "@/lib/accounting/format";
import type { Profitability } from "@/lib/events/lifecycle";

/**
 * Compact gross-profitability readout for the event hub: contracted revenue
 * against summed vendor cost, with the resulting margin and margin %. Derived
 * entirely from data the detail page already fetches — no queries here. Lets an
 * ops lead spot an under-water job before approving more vendor spend.
 */
export function ProfitabilitySummary({ data }: { data: Profitability }) {
  const { revenue, vendorCost, margin, marginPct } = data;
  const underWater = margin < 0;

  const marginPctLabel =
    marginPct == null
      ? "—"
      : marginPct.toLocaleString("en-US", {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        });

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">
          Profitability
        </h2>
        {underWater && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            Under water
          </span>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="eyebrow">Revenue</p>
          <p className="mt-1 text-sm text-ink">{formatMoney(revenue)}</p>
        </div>
        <div>
          <p className="eyebrow">Vendor cost</p>
          <p className="mt-1 text-sm text-ink">{formatMoney(vendorCost)}</p>
        </div>
        <div>
          <p className="eyebrow">Gross margin</p>
          <p
            className={`mt-1 text-sm font-medium ${
              underWater ? "text-red-700" : "text-ink"
            }`}
          >
            {formatMoney(margin)}
          </p>
        </div>
        <div>
          <p className="eyebrow">Margin %</p>
          <p
            className={`mt-1 text-sm ${
              underWater ? "text-red-700" : "text-ink"
            }`}
          >
            {marginPctLabel}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Revenue is the job&rsquo;s contracted total; vendor cost is the sum of
        agreed vendor costs on this event.
      </p>
    </section>
  );
}
