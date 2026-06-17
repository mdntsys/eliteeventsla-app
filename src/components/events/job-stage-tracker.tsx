import { JOB_STAGES } from "@/lib/events/lifecycle";

/**
 * Horizontal job-lifecycle pipeline for the event hub. Renders the ordered
 * JOB_STAGES with the current stage highlighted (navy). When the job is
 * cancelled, the pipeline is dimmed and a "Cancelled" chip is shown instead of
 * a highlighted stage.
 */
export function JobStageTracker({
  current,
  status,
}: {
  current: { key: string; index: number };
  status: string;
}) {
  const cancelled = status === "cancelled";

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="eyebrow">Job lifecycle</p>
        {cancelled && (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Cancelled
          </span>
        )}
      </div>

      <ol
        className={`flex flex-wrap items-center gap-x-2 gap-y-3 ${
          cancelled ? "opacity-50" : ""
        }`}
      >
        {JOB_STAGES.map((stage, i) => {
          const isCurrent = !cancelled && i === current.index;
          const isDone = !cancelled && i < current.index;
          return (
            <li key={stage.key} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition ${
                  isCurrent
                    ? "bg-navy text-cream"
                    : isDone
                      ? "border border-navy/30 bg-cream text-navy"
                      : "border border-line bg-cream text-muted"
                }`}
              >
                {stage.label}
              </span>
              {i < JOB_STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px w-5 ${
                    isDone ? "bg-navy/40" : "bg-line"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
