/**
 * Instant loading state for any (app) route while its server component fetches.
 * Mirrors the standard page shape — a header block over a few card placeholders —
 * so navigation feels immediate instead of blank. Renders inside AppChrome, so
 * the sidebar stays put.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>

      {/* Header placeholder (mirrors PageHeader) */}
      <div className="mb-8 border-b border-line pb-6">
        <div className="h-2.5 w-24 rounded bg-cream-deep" />
        <div className="mt-3 h-7 w-64 rounded bg-cream-deep" />
        <div className="mt-3 h-3.5 w-80 max-w-full rounded bg-cream-deep" />
      </div>

      {/* Card placeholders */}
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-(--radius-card) border border-line bg-card p-6"
          >
            <div className="h-3 w-32 rounded bg-cream-deep" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="h-2.5 w-16 rounded bg-cream-deep" />
                  <div className="h-3.5 w-full rounded bg-cream-deep" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
