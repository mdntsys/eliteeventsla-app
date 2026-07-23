/**
 * Time helpers pinned to the business timezone (Pacific — America/Los_Angeles).
 *
 * Elite Events LA operates entirely in Pacific, and everyone using the app is on
 * Pacific. Supabase stores every `timestamptz` in UTC (correct), but two things
 * MUST be handled explicitly around that boundary:
 *
 *  1. WRITE — a naive `datetime-local` value the user types (e.g. "2026-07-11T09:00")
 *     is a Pacific WALL-CLOCK time. Do NOT feed it to `new Date(v)`: on the
 *     production server (UTC) that parses it as 09:00 UTC, i.e. 2:00 AM Pacific —
 *     the exact bug this module exists to prevent. Convert via
 *     `pacificWallClockToUtcISO` so 9am Pacific is stored as 16:00 UTC.
 *
 *  2. DISPLAY — never format a timestamp with `toLocale*` and no `timeZone`; that
 *     uses the viewer's (or server's) zone. Always format in Pacific, either via
 *     `formatPacific` here or by passing `timeZone: APP_TIME_ZONE` explicitly.
 *
 * Pure-date columns ("YYYY-MM-DD", e.g. event_date/due_date) are timezone-less and
 * should keep being formatted with `timeZone: "UTC"` to avoid off-by-one drift.
 */

export const APP_TIME_ZONE = "America/Los_Angeles";

/**
 * The offset (Pacific wall-clock minus real UTC) in milliseconds at a given
 * instant — negative for Pacific (-7h in PDT, -8h in PST). Uses Intl so DST is
 * handled without a date library.
 */
function tzOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - instant;
}

/**
 * Interpret a naive "YYYY-MM-DDTHH:mm" (`datetime-local`) value as a Pacific
 * wall-clock time and return the matching UTC instant as an ISO string. Returns
 * null for empty/invalid input. DST-correct except within the ~1h ambiguity at a
 * transition, where it resolves to the pre-transition offset (acceptable).
 */
export function pacificWallClockToUtcISO(local: string): string | null {
  const m = local
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  const provisional = Date.UTC(+y, +mo - 1, +d, +hh, +mm, ss ? +ss : 0);
  const actual = provisional - tzOffsetMs(provisional);
  const dt = new Date(actual);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/**
 * Turn a stored UTC ISO timestamp into a "YYYY-MM-DDTHH:mm" value in Pacific, for
 * pre-filling a `<input type="datetime-local">`. "" for empty/invalid.
 */
export function utcToPacificInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Today's business date as "YYYY-MM-DD" in Pacific, for writing pure DATE
 * columns. `new Date().toISOString().slice(0, 10)` is the bug this replaces: on
 * the production server (UTC) anything logged after 5pm Pacific would be stamped
 * with tomorrow's date.
 */
export function pacificToday(): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the DATE wire format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Format a stored UTC timestamp in Pacific. Pass the same options you'd give
 * `toLocaleString`; `timeZone` is forced to Pacific. Returns `fallback` for
 * empty/invalid input.
 */
export function formatPacific(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString("en-US", { ...options, timeZone: APP_TIME_ZONE });
}
