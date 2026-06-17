<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Elite Events LA — Operations OS

Internal operations platform for Elite Events LA (event rentals / event services).
Deploys to **app.eliteeventsla.com**. This is a **separate** repo/app from the marketing
site in `../Website`; it holds client PII and payment secrets, so it keeps its own repo,
deployment, and auth. Do not couple the two — brand tokens were one-time-copied, not shared.

## Stack
- **Next.js 16.2.9** (App Router) · React 19.2 · TypeScript · Tailwind v4 (CSS-first)
- **Supabase** — Auth + Postgres + RLS + Storage, via `@supabase/ssr` (cookie sessions)
- **Stripe** — payment links + webhook
- **Resend** — transactional email

## Next.js 16 gotchas (already bitten, do not regress)
- `middleware.ts` is now **`proxy.ts`** (root). Session refresh lives in `proxy.ts` →
  `src/lib/supabase/middleware.ts:updateSession`.
- `cookies()` / `headers()` are **async** — `await` them.
- Page `params` / `searchParams` are **async** Promises — `await` them.
- Tailwind v4 is **CSS-first**: tokens in `@theme` in `src/app/globals.css`, no `tailwind.config.js`.
- Stripe webhook needs the **raw** request body: `await req.text()` before `constructEvent`.

## Auth & roles
- Invite-only. Public signup is disabled in Supabase Auth. Admins create users; a new user's
  `profiles.role` is **NULL until an admin assigns** one (NULL = no data access).
- Roles: `admin | sales | ops | accounting`. `admin` can do everything.
- Server-side gate: `src/lib/auth/dal.ts` (`requireUser` / `requireProfile` / `requireRole`).
  Module access map: `src/lib/auth/roles.ts`. `proxy.ts` is only the optimistic redirect gate —
  real authorization happens in the DAL + RLS.
- Bootstrap the first admin with SQL: `update profiles set role='admin' where email='…';`

## Supabase clients
- `src/lib/supabase/server.ts` — server components / actions (anon key, RLS-enforced).
- `src/lib/supabase/client.ts` — browser (anon key).
- `src/lib/supabase/service.ts` — **service role, server-only, bypasses RLS.** Webhooks only.
- RLS is on for every table; see `supabase/migrations/`. Run `get_advisors` after schema changes.

## Conventions
- Path alias `@/*` → `src/*`.
- Module routes live under `src/app/(app)/` behind the authenticated shell.
- Migrations are plain SQL in `supabase/migrations/NNNN_*.sql`, applied in order (immutable once
  applied — add a new migration to change schema); `supabase/seed.sql` holds reference data.
- After schema changes: regenerate `src/lib/database.types.ts` and run the security advisor.

## Deferred by design — wire up with the relevant feature
A security/integrity review (see migration `0009`) confirmed two real gaps that are intentionally
left for the feature pass that adds writers to those tables — they're noise to enforce on empty
tables and need the feature's semantics to get right:
- **Inventory availability guards** (`event_items`): no DB-level guard yet against double-booking a
  serialized `unit_id` over overlapping windows, against `kind`↔`unit_id` mismatch, or against bulk
  reservations exceeding `inventory_items.quantity`. When building inventory CRUD, add a
  `btree_gist` EXCLUDE constraint on `(unit_id, tstzrange(reserved_from, reserved_to))`, a
  `kind`-consistency trigger, and a bulk-capacity trigger; consider making the reserve window NOT NULL.
- **Maintenance history on delete** (`maintenance_records`): FKs are `ON DELETE CASCADE`, so deleting
  an item/unit wipes repair/cost history. Prefer retiring assets (`status='retired'`) over deletion;
  if hard delete is added, denormalize an asset label and switch to `SET NULL`.
