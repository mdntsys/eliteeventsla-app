import Link from "next/link";
import type { PipelineColumn } from "@/lib/crm/types";

/**
 * Read-only pipeline board: one column per stage (in sort_order), each holding
 * the deal cards that sit in that stage. Cards link to the deal detail page,
 * where the stage can be changed. Won/lost columns get a subtle accent.
 * Server component — no client interactivity here.
 */

function formatMoney(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function columnAccent(column: PipelineColumn): string {
  if (column.stage.is_won) return "border-green-200";
  if (column.stage.is_lost) return "border-line";
  return "border-line";
}

export function PipelineBoard({ columns }: { columns: PipelineColumn[] }) {
  if (columns.length === 0) {
    return (
      <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-10 text-center text-sm text-muted">
        No pipeline stages configured.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-full gap-4">
        {columns.map((column) => {
          const total = column.deals.reduce(
            (sum, d) => sum + (d.estimated_value ?? 0),
            0,
          );
          const totalLabel = formatMoney(total);
          return (
            <div
              key={column.stage.id}
              className="flex w-72 shrink-0 flex-col"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-navy">
                    {column.stage.name}
                  </h2>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-line bg-cream px-1.5 text-xs font-medium text-muted">
                    {column.deals.length}
                  </span>
                </div>
                {total > 0 && (
                  <span className="text-xs text-muted">{totalLabel}</span>
                )}
              </div>

              <div
                className={`flex min-h-24 flex-col gap-2.5 rounded-(--radius-card) border border-dashed bg-cream/60 p-2.5 ${columnAccent(
                  column,
                )}`}
              >
                {column.deals.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted">
                    No deals
                  </p>
                ) : (
                  column.deals.map((deal) => {
                    const money = formatMoney(deal.estimated_value);
                    const date = formatDate(deal.expected_event_date);
                    const who =
                      [deal.contact_name, deal.company_name]
                        .filter(Boolean)
                        .join(" · ") || null;
                    return (
                      <Link
                        key={deal.id}
                        href={`/crm/deals/${deal.id}`}
                        className="block rounded-(--radius-card) border border-line bg-card p-3 transition hover:border-navy"
                      >
                        <p className="text-sm font-medium text-navy">
                          {deal.title}
                        </p>
                        {who && (
                          <p className="mt-1 text-xs text-muted">{who}</p>
                        )}
                        {(money || date) && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            {money && (
                              <span className="font-medium text-ink">
                                {money}
                              </span>
                            )}
                            {date && (
                              <span className="text-muted">{date}</span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
