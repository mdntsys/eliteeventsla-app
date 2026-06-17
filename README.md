# Elite Events LA — Operations OS

Internal operations platform for **Elite Events LA** (event rentals / event services),
covering the full client lifecycle from inquiry to delivery/return across three teams:

- **CRM / Sales** — leads, contacts, companies, pipeline, activities & follow-ups
- **Operations** — inventory (bulk + serialized machines), scheduling, vendor network, servicing
- **Accounting** — Stripe payment links, invoices, payment reconciliation

Deploys to **app.eliteeventsla.com**. Separate from the marketing site (`../Website`).

## Stack
Next.js 16.2.9 (App Router) · React 19.2 · TypeScript · Tailwind v4 · Supabase (Auth + Postgres +
RLS + Storage) · Stripe · Resend.

> ⚠️ This app runs on Next.js 16, which differs from older conventions (e.g. `proxy.ts` replaces
> `middleware.ts`). See [AGENTS.md](./AGENTS.md) before contributing.

## Getting started

```bash
cp .env.example .env.local   # then fill in Supabase / Stripe / Resend values
npm install
npm run dev                  # http://localhost:3000
```

You'll be redirected to `/login`. Create a user in the Supabase dashboard (Auth → Users), then
make them an admin:

```sql
update public.profiles set role = 'admin' where email = 'you@eliteeventsla.com';
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/(app)/` | Authenticated shell + module routes (CRM, Operations, Events, Accounting, Admin) |
| `src/app/login/` | Login (invite-only, email + password) |
| `src/app/api/stripe/webhook/` | Stripe webhook → writes payment status (service role) |
| `src/lib/supabase/` | Browser / server / service Supabase clients + session refresh |
| `src/lib/auth/` | Data Access Layer (`requireUser`/`requireRole`) + role→module access map |
| `supabase/migrations/` | Ordered SQL migrations (schema + RLS) |
| `supabase/seed.sql` | Reference data (pipeline stages, inventory & vendor categories) |
| `proxy.ts` | Supabase session refresh + auth redirects (Next 16 middleware) |

## Scripts
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
