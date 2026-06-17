-- 0006 — Accounting: invoices, line items, payments, and the Stripe webhook
-- idempotency/audit log.

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references public.events(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  company_id     uuid references public.companies(id) on delete set null,
  invoice_number text unique,
  status         public.invoice_status not null default 'draft',
  subtotal       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  total_amount   numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  issued_date    date,
  due_date       date,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index invoices_event_id_idx on public.invoices (event_id);
create index invoices_status_idx on public.invoices (status);
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_line_items
-- ---------------------------------------------------------------------------
create table public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null default 0,
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);
create index invoice_line_items_invoice_id_idx on public.invoice_line_items (invoice_id);

-- ---------------------------------------------------------------------------
-- payments — Stripe payment links written here; webhook updates status.
-- ---------------------------------------------------------------------------
create table public.payments (
  id                         uuid primary key default gen_random_uuid(),
  invoice_id                 uuid references public.invoices(id) on delete set null,
  event_id                   uuid references public.events(id) on delete set null,
  amount                     numeric(12,2) not null,
  currency                   text not null default 'usd',
  method                     public.payment_method not null default 'stripe',
  status                     public.payment_status not null default 'pending',
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  stripe_payment_link_id     text,
  stripe_customer_id         text,
  paid_at                    timestamptz,
  notes                      text,
  created_by                 uuid references public.profiles(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index payments_invoice_id_idx on public.payments (invoice_id);
create index payments_event_id_idx on public.payments (event_id);
-- Unique-where-present so the webhook can match exactly one row by Stripe id.
create unique index payments_stripe_pi_idx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index payments_stripe_cs_idx
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stripe_webhook_events — idempotency + audit. Service-role only (no RLS
-- policies are granted in 0007), since only the webhook touches it.
-- ---------------------------------------------------------------------------
create table public.stripe_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  type            text not null,
  payload         jsonb,
  processed_at    timestamptz,
  created_at      timestamptz not null default now()
);
