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
| **Accounting** | `/accounting`, `/accounting/invoices` (+ `[id]`), `/accounting/payments`; client-facing `/i/[token]` (+ `/api/invoice/[token]/{pdf,checkout}`) | ✅ Invoices (line items, statuses, balances) + payments (record + reconcile) + overview. **Client invoice delivery**: every invoice has an unguessable `public_token` → a branded, itemized **public page `/i/<token>`** (no login) that pays by **Stripe Checkout** (card) or shows global **Zelle/wire/check** instructions, plus a generated **PDF** (`@react-pdf/renderer`). "Send invoice to client" emails the link + PDF via Resend. **Stripe LIVE**: signed webhook reconciles Checkout *and* legacy payment links (match by session/link id) → invoice paid **+ event activated (draft→confirmed)**; refunds downgrade. Shared: `reconcile.ts`, `src/lib/invoices/public.ts`, `src/lib/pdf/invoice-pdf.tsx`. |
| **Emails (Resend)** | _infra, no route_ | ✅ Branded templates + guarded send helper (no-ops without key) wired to booking-confirmed / vendor-request / crew-assignment / return-receipt. |
| **Admin** | `/admin/team` | ✅ User + role management (admin only). |
| **Affiliates** | `/affiliates` (+ `[id]`) | ✅ Referral partners: provisioning (service-role login + welcome email), per-affiliate commission rate + status, isolated EIN store, commissions + payout ledger (owed/paid), and **per-event attribution + commission override on the event hub**. Commission accrues on the pre-tax subtotal when an attributed invoice is fully paid; reverses on refund/un-attribution. |
| **Documents / E-sign** | `/documents` (+ `[id]`, `/new`); public `/sign/[token]` | ✅ Central document store + DocuSign-like signing. Affiliate contracts + customer SOWs, consent + audit trail (IP/UA/UTC/SHA-256), executed PDF with a Certificate of Completion, expiring single-use tokens. |
| **Affiliate portal** | `/portal` (+ `/referrals`, `/payouts`, `/documents`, `/sign`) | ✅ External affiliate portal (own route group + shell, `affiliate` role, zero internal access). First-login contract-signing gate; dashboard, referrals, payouts, signed docs. |

## Data / schema
Postgres on Supabase (`@supabase/ssr`, cookie sessions). **Migrations `0001`–`0030`** applied (plain SQL in
`supabase/migrations/`, immutable once applied — add a new file to change schema). RLS on every table, keyed
on role via `current_app_role()` / `is_admin()` / `has_any_role()` / area helpers `can_view_module()` /
`can_edit_module()`, plus `current_affiliate_id()` for affiliate row-ownership (all enforce `is_active`).
Generated types in `src/lib/database.types.ts` (regenerate after any migration). Storage: `operations-proofs`
(private, return proofs) + `inventory-photos` (public) + `documents` (private, executed PDFs).

## Integrations — all live (secrets in gitignored `.env.local` + Vercel)
- **Stripe** ✅ LIVE: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set; webhook destination points at `app.eliteeventsla.com/api/stripe/webhook` (4 events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded). End-to-end lifecycle verified (19/19 smoke).
- **Resend** ✅ LIVE: `RESEND_API_KEY` + verified sender (`ops@eliteeventsla.com`). Transactional sends active.
- **Service role** ✅: `SUPABASE_SERVICE_ROLE_KEY` set — used by the Stripe webhook and the payment/convert cascades (`src/lib/supabase/service.ts`).
- Pending: roll the live Stripe key once (it was pasted in chat during setup); enable Supabase leaked-password protection.

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
