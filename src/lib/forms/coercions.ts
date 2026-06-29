import { z } from "zod";

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

/** HTML checkbox → boolean ("on"/"true" → true). Already null-safe. */
export const checkbox = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");
