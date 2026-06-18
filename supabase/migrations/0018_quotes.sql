-- 0018 — Quotes / estimates (Sales).
-- A quote is the pre-sale artifact: line items + validity, sent to a client, who
-- accepts it; an accepted quote converts into an event + a draft invoice (ties
-- CRM -> Operations -> Accounting). Mirrors the invoices shape; writes are
-- sales/admin (like the rest of CRM), reads are broad (any assigned role).

create type public.quote_status as enum (
  'draft', 'sent', 'accepted', 'declined', 'expired', 'converted'
);

create table public.quotes (
  id            uuid primary key default gen_random_uuid(),
  quote_number  text unique,
  title         text,
  contact_id    uuid references public.contacts(id) on delete set null,
  company_id    uuid references public.companies(id) on delete set null,
  deal_id       uuid references public.deals(id) on delete set null,
  event_id      uuid references public.events(id) on delete set null,
  invoice_id    uuid references public.invoices(id) on delete set null,
  status        public.quote_status not null default 'draft',
  subtotal      numeric(12,2) not null default 0,
  tax           numeric(12,2) not null default 0,
  total_amount  numeric(12,2) not null default 0,
  valid_until   date,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity    numeric(12,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- Covering indexes for the FKs we filter/join on.
create index quotes_contact_id_idx on public.quotes(contact_id);
create index quotes_company_id_idx on public.quotes(company_id);
create index quotes_event_id_idx on public.quotes(event_id);
create index quote_line_items_quote_id_idx on public.quote_line_items(quote_id);

-- RLS: broad read for any assigned role; writes sales/admin (matches CRM).
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;

create policy quotes_select on public.quotes
  for select to authenticated using (public.current_app_role() is not null);
create policy quotes_write on public.quotes
  for all to authenticated
  using (public.has_any_role('sales', 'admin'))
  with check (public.has_any_role('sales', 'admin'));

create policy quote_line_items_select on public.quote_line_items
  for select to authenticated using (public.current_app_role() is not null);
create policy quote_line_items_write on public.quote_line_items
  for all to authenticated
  using (public.has_any_role('sales', 'admin'))
  with check (public.has_any_role('sales', 'admin'));

grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_line_items to authenticated;
