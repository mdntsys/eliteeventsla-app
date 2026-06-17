/**
 * Rating display. Server component (no interactivity). Renders five stars filled
 * to the nearest half, alongside the numeric value. Shows an em dash when the
 * rating is null. Half-fill is done by overlaying a clipped filled star on top
 * of an empty one — no SVG gradient ids, so it is hydration-safe.
 */

const STAR_PATH =
  "M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L10 1.5z";

export function RatingStars({ rating }: { rating: number | null }) {
  if (rating == null) {
    return <span className="text-sm text-muted">—</span>;
  }

  const clamped = Math.max(0, Math.min(5, rating));
  const rounded = Math.round(clamped * 2) / 2; // nearest half

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${clamped.toFixed(1)} out of 5`}
    >
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => {
          const position = i + 1;
          const fill =
            rounded >= position ? 1 : rounded >= position - 0.5 ? 0.5 : 0;
          return <Star key={i} fill={fill} />;
        })}
      </span>
      <span className="text-sm tabular-nums text-ink">{clamped.toFixed(1)}</span>
    </span>
  );
}

function Star({ fill }: { fill: 0 | 0.5 | 1 }) {
  return (
    <span className="relative inline-block h-4 w-4">
      {/* base (empty) */}
      <svg viewBox="0 0 20 20" className="absolute inset-0 h-4 w-4 text-line" fill="currentColor">
        <path d={STAR_PATH} />
      </svg>
      {/* fill overlay, clipped to the fill fraction */}
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fill * 100}%` }}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-navy" fill="currentColor">
            <path d={STAR_PATH} />
          </svg>
        </span>
      )}
    </span>
  );
}
