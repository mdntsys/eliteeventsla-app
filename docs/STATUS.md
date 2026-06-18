# Project status — Elite Events LA Operations OS

_Snapshot of what's built. The **live, always-current** record is `git log` + the Progress log in
`AUTOPILOT.md` (gitignored). Update this file when a phase completes; don't treat it as authoritative
over git._

## What this is
Internal Operations OS for Elite Events LA (event rentals/services), deployed to **app.eliteeventsla.com**.
Separate repo/deploy/auth from the marketing site at `../Website` (holds client PII + payment secrets).
Repo: `git@github.com:mdntsys/eliteeventsla-app.git`, branch `main`. Stack + conventions: see `AGENTS.md`.

## Modules (all live on real Supabase data, RLS-enforced)

| Module | Routes (`src/app/(app)/…`) | State |
|---|---|---|
| **Dashboard** | `/dashboard` | ✅ Real ops overview: upcoming logistics, pending returns, vendors awaiting confirmation, urgent tickets, jobs-by-stage, follow-ups due. Role-aware. |
| **CRM** | `/crm` (pipeline), `/crm/contacts`, `/crm/companies`, `/crm/deals` (+ `[id]` details) | ✅ Contacts, companies, stage pipeline + deals, activities/follow-ups, **convert won deal → event**. |
| **Events / Jobs** | `/events` (+ `[id]` hub) | ✅ Event hub: inventory reservation, crew assignment, delivery/setup/pickup timeline, vendor & ticket panels, warehouse return w/ photo proof, lifecycle tracker + readiness checklist, auto-status, load-out manifest. |
| **Operations · Inventory** | `/operations/inventory` (+ `[id]`, `/locations`) | ✅ Bulk + serialized units + maintenance; structured locations (warehouse rows / offsite); per-item & per-unit photos; CSV import. |
| **Operations · Scheduling** | `/operations/scheduling` | ✅ Cross-job agenda + crew self-service (Mine/All, en route / arrived + arrival photo / done, logs actual times). |
| **Operations · Vendors** | `/operations/vendors` (+ `[id]`) | ✅ Directory/detail + per-event vendor panel. |
| **Operations · Servicing** | `/operations/servicing` (+ `[id]`) | ✅ Ticket queue + detail w/ threaded comments + categories; per-event tickets panel. |
| **Accounting** | `/accounting`, `/accounting/invoices` (+ `[id]`), `/accounting/payments` | ✅ Invoices (line items, statuses, balances) + payments (record + reconcile) + overview. Stripe payment-link behind a `getStripe()` guard (graceful "Connect Stripe" until key added). |
| **Emails (Resend)** | _infra, no route_ | ✅ Branded templates + guarded send helper (no-ops without key) wired to booking-confirmed / vendor-request / crew-assignment / return-receipt. |
| **Admin** | `/admin/team` | ✅ User + role management (admin only). |

## Data / schema
Postgres on Supabase (`@supabase/ssr`, cookie sessions). **Migrations `0001`–`0015`** applied (plain SQL in
`supabase/migrations/`, immutable once applied — add a new file to change schema). RLS on every table, keyed
on role via `current_app_role()` / `is_admin()` / `has_any_role()` (also enforce `is_active`). Generated
types in `src/lib/database.types.ts` (regenerate after any migration). Storage: `operations-proofs` (private,
return proofs) + `inventory-photos` (public).

## Blockers (need a human — secrets in gitignored `.env.local`)
- **Stripe**: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — payment-link creation + webhook end-to-end (test mode). Code is built behind a guard; live path blocked.
- **Resend**: `RESEND_API_KEY` + a verified sender — transactional email *sending*. Templates + triggers built; sending is a no-op until set.
- **Service role**: `SUPABASE_SERVICE_ROLE_KEY` — used only by the Stripe webhook (`src/lib/supabase/service.ts`).

## Demo data — do NOT modify
A seeded demo job is kept pristine for CEO demos. Treat `AUTOPILOT.md`'s "Do not touch" list as authoritative
(currently the Rivera photo-booth wedding + its rows, seeded inventory items/units + locations, the vendor
directory, and the staff accounts). Build test data only as throwaway `__autopilot`/`__AP` rows you delete.

## Commit history (high level)
```
e391f23 Build transactional emails (Resend)
4d64527 Build the Accounting module
e9e9e34 Build the ops Dashboard
f62febf Build the CRM module
4d731b4 Mobile-responsive app shell
1384841 / 104c215 Inventory: locations, photos, CSV import
3b83b79 Job lifecycle tracker, auto-status, load-out manifest, crew self-service
49639bc Servicing module (completes Operations)
40f9dbd Vendors module
4eb3856 Operations lifecycle: Event hub + Scheduling
a0312eb Inventory module (first live feature)
1a4f80b Foundation security/integrity review fixes
868c7f1 Scaffold foundation
```

## What's next
The original backlog (CRM → Dashboard → Accounting → Emails) is **complete**. The build now runs as a
**perpetual self-generating improvement loop** — operational depth, UI/UX, and hardening, balanced and
quality-gated. See `docs/AUTOPILOT-GUIDE.md`.
