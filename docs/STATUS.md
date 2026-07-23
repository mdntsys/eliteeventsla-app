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
| **Dashboard** | `/dashboard` | ✅ Real ops overview: upcoming logistics, pending returns, vendors awaiting confirmation, urgent tickets, jobs-by-stage, follow-ups due, **stale leads**. Role-aware. **Follow-ups due merges BOTH sources** — `activities.due_at` *and* `deals.follow_up_date` (the latter was previously invisible here) — overdue in red, won/lost excluded. |
| **CRM** | `/crm` (pipeline), `/crm/contacts`, `/crm/companies`, `/crm/deals` (+ `[id]` details) | ✅ Contacts, companies, stage pipeline + deals, activities/follow-ups, **convert won deal → event**. **Lead hygiene**: per-deal `contact_attempts` + `last_contacted_at` via one-click "Log a touch" (also writes an activity line), editable for backfill; **mark lost / delete a deal** (delete refused when the deal already became an event — `events.deal_id` is ON DELETE SET NULL). |
| **Events / Jobs** | `/events` (+ `[id]` hub, `[id]/pick-list`) | ✅ Event hub: inventory reservation, crew assignment, delivery/setup/pickup timeline, vendor & ticket panels, warehouse return w/ photo proof, lifecycle tracker + readiness checklist, auto-status, load-out manifest. **Per-event pick list PDF** (`/events/[id]/pick-list`) grouped by warehouse location/row with quantities, asset tags + check boxes. |
| **Operations · Inventory** | `/operations/inventory` (+ `[id]`, `/locations`, `/kits` + `[id]`) | ✅ Bulk + serialized units + maintenance; structured locations (warehouse rows / offsite); per-item & per-unit photos; CSV import. **Bundles ("kits")** — a named, *located* pallet of gear pulled/booked as one (`Photo Booth A`/`B` seeded). Lines are `(item, quantity)` so one bulk item splits across two bundles; a serialized `unit_id` can be pinned. "Reserve a bundle" on the event hub explodes it into ordinary `event_items` (so availability, the EXCLUDE guard, pick list, and check-out/return are untouched) and is **partial by design** — books what's free over the window, reports the gaps. Bulk "add selection to a bundle" from the list. **List now shows live "reserved / available"** (any outstanding reservation — upcoming, current, or checked out — netted against on-hand; a fully-past unreturned one auto-releases) + **reserve to an event straight from the list** (per-row modal → same `event_items` write). **Bulk "assign to location"** (multi-select → set storage location on items + their units). **Mistake-safe item delete** (hard delete only when the item has no reservation history; otherwise retire to keep history). |
| **Operations · Scheduling** | `/operations/scheduling` | ✅ Cross-job agenda + crew self-service (Mine/All, en route / arrived + arrival photo / done, logs actual times). |
| **Operations · Vendors** | `/operations/vendors` (+ `[id]`) | ✅ Directory/detail + per-event vendor panel. |
| **Operations · Servicing** | `/operations/servicing` (+ `[id]`) | ✅ Ticket queue + detail w/ threaded comments + categories; per-event tickets panel. |
| **Accounting** | `/accounting`, `/accounting/invoices` (+ `[id]`), `/accounting/payments`; client-facing `/i/[token]` (+ `/api/invoice/[token]/{pdf,checkout}`) | ✅ Invoices (line items, statuses, balances) + payments (record + reconcile) + overview. **Client invoice delivery**: every invoice has an unguessable `public_token` → a branded, itemized **public page `/i/<token>`** (no login) that pays by **Stripe Checkout** (card) or shows global **Zelle/wire/check** instructions, plus a generated **PDF** (`@react-pdf/renderer`). "Send invoice to client" emails the link + PDF via Resend. **Stripe LIVE**: signed webhook reconciles Checkout *and* legacy payment links (match by session/link id) → invoice paid **+ event activated (draft→confirmed)**; refunds downgrade. Shared: `reconcile.ts`, `src/lib/invoices/public.ts`, `src/lib/pdf/invoice-pdf.tsx`. **Abandoned checkouts** no longer masquerade as owed money: a repeat "Pay" click reuses the invoice's in-flight pending row instead of stacking a new one, reconcile retires leftovers once an invoice is paid/void, `checkout.session.expired` is handled, and `payment_status` gained `cancelled` (shown as "Abandoned"). Never affects `amount_paid`, which counts `succeeded` only. |
| **Emails (Resend)** | _infra, no route_ | ✅ Branded templates + guarded send helper (no-ops without key) wired to booking-confirmed / vendor-request / crew-assignment / return-receipt. |
| **Admin** | `/admin/team` | ✅ User + role management (admin only). |
| **Affiliates** | `/affiliates` (+ `[id]`, `/tax`) | ✅ Referral partners: provisioning (service-role login + welcome email), per-affiliate commission rate + status, **per-event attribution + commission override on the event hub**. Commission accrues on the pre-tax subtotal when an attributed invoice is fully paid; reverses on refund/un-attribution; the affiliate is emailed. **Payouts**: selective (pick which commissions) + voidable ledger, **hard-gated on a W-9 being on file**; the affiliate is emailed. **Tax (super-admin only)**: isolated EIN + W-9 store (private `affiliate-tax` bucket, service-role-only) + a **1099 report** (`/affiliates/tax`, cash paid per year, $600 flag, CSV export). |
| **Documents / E-sign** | `/documents` (+ `[id]`, `/new`); public `/sign/[token]` | ✅ Central document store + DocuSign-like signing. Affiliate contracts + customer SOWs, consent + audit trail (IP/UA/UTC/SHA-256), executed PDF with a Certificate of Completion, expiring single-use tokens. |
| **Affiliate portal** | `/portal` (+ `/referrals`, `/payouts`, `/documents`, `/sign`) | ✅ External affiliate portal (own route group + shell, `affiliate` role, zero internal access). First-login contract-signing gate; dashboard, referrals, payouts, signed docs. |

## Data / schema
Postgres on Supabase (`@supabase/ssr`, cookie sessions). **Migrations `0001`–`0037`** applied (plain SQL in
`supabase/migrations/`, immutable once applied — add a new file to change schema). RLS on every table, keyed
on role via `current_app_role()` / `is_admin()` / `has_any_role()` / area helpers `can_view_module()` /
`can_edit_module()`, plus `current_affiliate_id()` for affiliate row-ownership (all enforce `is_active`).
Generated types in `src/lib/database.types.ts` (regenerate after any migration). Storage: `operations-proofs`
(private, return proofs) + `inventory-photos` (public) + `documents` (private, executed PDFs) + `affiliate-tax`
(private, W-9s — service-role-only, no authenticated policy).

## Integrations — all live (secrets in gitignored `.env.local` + Vercel)
- **Stripe** ✅ LIVE: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set; webhook destination points at `app.eliteeventsla.com/api/stripe/webhook` (4 events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded). End-to-end lifecycle verified (19/19 smoke). **Pending in the Stripe dashboard:** add a 5th event, `checkout.session.expired` — the handler already exists and closes an abandoned attempt out the moment Stripe expires it. Until it's subscribed, reconcile still retires leftovers when the invoice settles, so this is a tidiness upgrade, not a correctness gap.
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
