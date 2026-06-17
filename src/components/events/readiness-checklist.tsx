import type { ReadinessItem } from "@/lib/events/lifecycle";

/**
 * Compact dispatch-readiness checklist for the event hub. Each check renders a
 * ✓ (navy) when ok or a ✗ (amber) when not, plus its short detail. When every
 * check passes, a small "Ready for dispatch" summary is shown.
 */
export function ReadinessChecklist({ items }: { items: ReadinessItem[] }) {
  const allOk = items.length > 0 && items.every((i) => i.ok);

  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="eyebrow">Dispatch readiness</p>
        {allOk && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Ready for dispatch
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                item.ok
                  ? "bg-navy text-cream"
                  : "border border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              {item.ok ? "✓" : "✗"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
