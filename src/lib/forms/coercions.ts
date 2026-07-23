import { z } from "zod";
import { pacificWallClockToUtcISO, pacificDayBoundUtcISO } from "@/lib/time";

/**
 * Shared, null-safe form-field coercions for server actions.
 *
 * Every server action validates `FormData` with zod. `FormData.get(name)`
 * returns `string | File | null` — and crucially returns **null** when the form
 * never rendered that field at all (e.g. the deal form omits `owner_id`). The
 * original per-module coercions each started with `z.string()`, which rejects
 * null outright with *"invalid input: expected string, received null"*. That
 * turned any optional-but-unrendered field into a hard crash on submit.
 *
 * These versions normalize the raw value to a string up front (via `toStr`), so
 * an absent field (null/undefined) is treated identically to an empty one ("").
 * Defining them once here also kills the ~30 copy-pasted definitions that used
 * to drift across modules. Behaviour for real (non-null) input is unchanged.
 *
 * Two money variants exist on purpose:
 *  - `optionalMoney`     — empty/absent → `null` (CRM, vendors, inventory, events)
 *  - `optionalMoneyZero` — empty/absent → `0`    (accounting, quotes)
 */

/**
 * Coerce any FormData value to a string. `string` passes through; everything
 * else a form select/input could yield (null when unrendered, undefined when a
 * key is absent, or a File) collapses to "". Guarantees the downstream string
 * logic — `.trim()`, refinements — never sees a non-string and never throws.
 */
function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Empty/absent → null; otherwise a trimmed string. */
export const optionalText = z.preprocess(
  toStr,
  z.string().transform((v) => {
    const t = v.trim();
    return t === "" ? null : t;
  }),
);

/** Empty/absent → null; otherwise a trimmed, validated email. */
export const optionalEmail = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Enter a valid email.",
    })
    .transform((v) => (v === "" ? null : v)),
);

/** Empty/absent → null; otherwise a validated uuid. */
export const optionalUuid = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || z.uuid().safeParse(v).success, {
      message: "Invalid id.",
    })
    .transform((v) => (v === "" ? null : v)),
);

/** Empty/absent → null; otherwise a non-negative number. */
export const optionalMoney = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => {
        if (v === "") return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0;
      },
      { message: "Enter a valid amount." },
    )
    .transform((v) => (v === "" ? null : Number(v))),
);

/** Empty/absent → 0; otherwise a non-negative number. */
export const optionalMoneyZero = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => {
        if (v === "") return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0;
      },
      { message: "Enter a valid amount." },
    )
    .transform((v) => (v === "" ? 0 : Number(v))),
);

/** Required, non-negative money amount. */
export const money = z.preprocess(
  toStr,
  z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, "Enter a valid amount."),
);

/** Empty/absent → null; otherwise a non-negative whole number. */
export const optionalInt = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => {
        if (v === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 0;
      },
      { message: "Enter a valid whole number." },
    )
    .transform((v) => (v === "" ? null : Number(v))),
);

/** Empty/absent → null; otherwise a number in [0, 5]. */
export const optionalRating = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine(
      (v) => {
        if (v === "") return true;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 5;
      },
      { message: "Rating must be between 0 and 5." },
    )
    .transform((v) => (v === "" ? null : Number(v))),
);

/** Empty/absent → null; otherwise a validated date (YYYY-MM-DD passes through). */
export const optionalDate = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), {
      message: "Enter a valid date.",
    })
    .transform((v) => (v === "" ? null : v)),
);

/** Empty/absent → null; otherwise a datetime-local value as an ISO string. */
export const optionalDateTime = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), {
      message: "Enter a valid date and time.",
    })
    .transform((v) => (v === "" ? null : new Date(v).toISOString())),
);

/** Alias of {@link optionalDateTime} (events module naming). */
export const optionalTimestamp = optionalDateTime;

/**
 * Empty/absent → null; otherwise a `datetime-local` wall-clock value interpreted
 * as **Pacific** and stored as a UTC ISO string. Use this (not optionalTimestamp)
 * for any `<input type="datetime-local">` a user types a local time into —
 * scheduling stops, follow-up due times, SOW start/end — so 9am Pacific is saved
 * as 16:00 UTC instead of being mis-stamped as 9am UTC. See {@link pacificWallClockToUtcISO}.
 */
export const optionalPacificDateTime = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || pacificWallClockToUtcISO(v) !== null, {
      message: "Enter a valid date and time.",
    })
    .transform((v) => (v === "" ? null : pacificWallClockToUtcISO(v))),
);

/**
 * Empty/absent → null; otherwise a reservation-window bound stored as UTC.
 *
 * These take an `<input type="date">` value and bound the PACIFIC day: the
 * "from" end becomes 00:00 Pacific, the "to" end 23:59:59 Pacific. Do not use
 * plain {@link optionalTimestamp} for a reservation window — `new Date("2026-08-15")`
 * is UTC midnight, i.e. 5pm Pacific the day BEFORE, and a single-day job then
 * gets `reserved_from === reserved_to`. That zero-length window is an EMPTY
 * range to Postgres, and an empty range overlaps nothing, so it silently
 * defeated the `event_items` double-booking EXCLUDE constraint.
 */
export const optionalReserveFrom = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || pacificDayBoundUtcISO(v, "start") !== null, {
      message: "Enter a valid start date.",
    })
    .transform((v) => (v === "" ? null : pacificDayBoundUtcISO(v, "start"))),
);

/** The closing bound of a reservation window. See {@link optionalReserveFrom}. */
export const optionalReserveTo = z.preprocess(
  toStr,
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v === "" || pacificDayBoundUtcISO(v, "end") !== null, {
      message: "Enter a valid end date.",
    })
    .transform((v) => (v === "" ? null : pacificDayBoundUtcISO(v, "end"))),
);

/** HTML checkbox → boolean ("on"/"true" → true). Already null-safe. */
export const checkbox = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");
