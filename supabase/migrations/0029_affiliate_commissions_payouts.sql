-- 0029 — Affiliate commissions + payouts (Phase 2).
--
-- Commission is earned per attributed invoice once that invoice is FULLY paid
-- (contract: "15% of the gross revenue collected ... after the Company receives
-- full payment"), computed on the PRE-TAX subtotal, and reversed if the invoice
-- later leaves 'paid' (refund/chargeback). Accrual is driven by the payment
-- reconciler (lib/accounting/reconcile.ts). Payouts are a manual ledger the team
-- records; recording one marks the covered commissions 'paid'.

create type public.commission_status as enum ('accrued', 'paid', 'reversed');

-- One commission per attributed invoice.
create table public.affiliate_commissions (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  event_id     uuid references public.events(id) on delete set null,
  invoice_id   uuid not null unique references public.invoices(id) on delete cascade,
  basis_amount numeric(12, 2) not null default 0,
  rate         numeric(5, 4) not null default 0,
  amount       numeric(12, 2) not null default 0,
  status       public.commission_status not null default 'accrued',
  payout_id    uuid,
  earned_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index affiliate_commissions_affiliate_id_idx on public.affiliate_commissions (affiliate_id);
create index affiliate_commissions_event_id_idx on public.affiliate_commissions (event_id);
create index affiliate_commissions_payout_id_idx on public.affiliate_commissions (payout_id);
create trigger set_updated_at before update on public.affiliate_commissions
  for each row execute function public.set_updated_at();

-- Manual payout ledger (no funds movement — a record of what was paid).
create table public.affiliate_payouts (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount       numeric(12, 2) not null default 0,
  method       text,
  reference    text,
  notes        text,
  paid_at      timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index affiliate_payouts_affiliate_id_idx on public.affiliate_payouts (affiliate_id);
create trigger set_updated_at before update on public.affiliate_payouts
  for each row execute function public.set_updated_at();

alter table public.affiliate_commissions
  add constraint affiliate_commissions_payout_id_fkey
  foreign key (payout_id) references public.affiliate_payouts(id) on delete set null;

-- Optional per-event rate override; when null the affiliate's own rate applies.
alter table public.events
  add column commission_rate_override numeric(5, 4)
    check (commission_rate_override is null
           or (commission_rate_override >= 0 and commission_rate_override <= 1));

-- RLS: staff (affiliates area) manage; an affiliate reads only their OWN rows.
alter table public.affiliate_commissions enable row level security;
create policy affiliate_commissions_select on public.affiliate_commissions
  for select to authenticated
  using (public.can_view_module('affiliates')
         or affiliate_id = public.current_affiliate_id());
create policy affiliate_commissions_write on public.affiliate_commissions
  for all to authenticated
  using (public.can_edit_module('affiliates'))
  with check (public.can_edit_module('affiliates'));

alter table public.affiliate_payouts enable row level security;
create policy affiliate_payouts_select on public.affiliate_payouts
  for select to authenticated
  using (public.can_view_module('affiliates')
         or affiliate_id = public.current_affiliate_id());
create policy affiliate_payouts_write on public.affiliate_payouts
  for all to authenticated
  using (public.can_edit_module('affiliates'))
  with check (public.can_edit_module('affiliates'));

grant select, insert, update, delete on public.affiliate_commissions to authenticated;
grant select, insert, update, delete on public.affiliate_payouts to authenticated;
