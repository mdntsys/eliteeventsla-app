# Build patterns — how this codebase is put together

The conventions every module follows. New work should match these closely (the autopilot loop does).
For framework rules (Next 16, Tailwind v4, async params, `proxy.ts`) and auth/RLS specifics, see `AGENTS.md`.

## Folder layout (per module)
```
src/lib/<module>/
  types.ts      # Row aliases from Database, view types, Option, ActionState
  queries.ts    # read paths — server-only
  actions.ts    # write paths — "use server"
src/app/(app)/<module>/        # pages behind the authed shell
  page.tsx                     # list / overview
  [id]/page.tsx                # detail (params is a Promise — await it)
src/components/<module>/       # the module's client/server components
```
Path alias: `@/*` → `src/*`. Module routes live under `src/app/(app)/` (the authenticated `AppChrome` shell).

## Data layer
- **types.ts** — `type Tables = Database["public"]["Tables"]; export type X = Tables["x"]["Row"];`
  Add view types (e.g. `XListRow = X & { joined_name: string | null }`), `Option = {id,label}`, and
  `ActionState = { error?; success?; … } | undefined`.
- **queries.ts** — starts with `import "server-only";`. Use `createClient` from `@/lib/supabase/server`,
  `throw new Error(error.message)` on failure, and **cast nested joins manually** (Supabase's nested types
  are awkward — `const rows = (data ?? []) as RowWithJoins[]`, see `src/lib/vendors/queries.ts`).
- **actions.ts** — starts with `"use server";`. Every action: `await requireModule("<module>")` (defense in
  depth alongside RLS), validate with **zod** (reuse the `optionalText`/`optionalUuid`/`optionalMoney`
  coercions seen in `vendors`/`accounting` actions), mutate via `createClient`, `revalidatePath(...)` the
  affected routes, and return `ActionState`. **`redirect()` throws to navigate — keep it OUTSIDE any
  try/catch.** Surface friendly messages for PG codes (`23505` unique, `23P01` exclusion).

## Auth / RLS
- Server gate: `@/lib/auth/dal` — `requireUser` / `requireProfile` / `requireModule(moduleKey)`. Module→role
  map in `@/lib/auth/roles` (`canAccess`, `ModuleKey`). The landing dashboard uses `requireProfile` (any role).
- `proxy.ts` is only the optimistic redirect gate — real authorization is the DAL + RLS.
- Write roles by module: CRM = sales/admin · Operations/Events = ops/admin · Accounting = accounting/admin ·
  config tables = admin. Broad authenticated read. Never expose the service-role key to the client.

## UI conventions
- `PageHeader` (`eyebrow` is a **string**, `action` is ReactNode) tops every page.
- Status pills: `StatusBadge` (`@/components/inventory/status-badge`) for inventory/generic; module-specific
  badges where states differ (e.g. `@/components/accounting/accounting-badges`).
- **Toggleable inline form pattern** (see `crm/deal-form.tsx`, `accounting/invoice-form.tsx`): a client
  component using `useActionState`; a button toggles an inline card form; selects fed from `Option[]` queries;
  close-on-success is done in the **render body** (`if (state?.success && open) setOpen(false)`), NOT in a
  `useEffect` (eslint `react-hooks/set-state-in-effect` forbids it).
- Brand: `bg-cream` / `text-navy` / `text-ink` / `text-muted` / `border-line`, `rounded-(--radius-card)`,
  `.eyebrow`, `.font-display` (Cormorant). Tailwind v4 tokens live in `@theme` in `globals.css` — no config file.
- Shared `<ImageUpload>` (`@/components/shared`) for file/paste/drag uploads to the public bucket.
- Mobile: the responsive shell is `app-chrome.tsx` + `sidebar-content.tsx` (desktop static sidebar, mobile
  hamburger drawer). Pages should stack on small screens.

## Verification recipe (the gate — never skip before committing)
1. `npx tsc --noEmit` && `npm run build` && `npx eslint .` — all must pass.
2. For new data/RLS/storage paths, a **live smoke** in Node: log in as admin (creds + Supabase URL +
   publishable key are in `AUTOPILOT.md`), hit `/rest/v1` / `/storage/v1` to exercise the exact paths the new
   code uses, assert results, then **delete every throwaway row** (use `__autopilot`/`__AP` prefixes). See the
   smoke scripts the loop writes to `/tmp/*.mjs` for the shape.

## Commit & publish
- `git -c user.name="Claude Code" -c user.email="noreply@anthropic.com" commit -m "…"` — **NO
  `Co-Authored-By` trailer** (user preference for this repo).
- One feature = one revertible commit. Push to `main` only on all-green. Never push red.
- Confirm no secrets staged: `git diff --cached --name-only | grep -E "\.env($|\.local)"` must be empty.
