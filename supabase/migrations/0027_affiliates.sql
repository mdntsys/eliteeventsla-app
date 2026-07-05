-- 0027 — Affiliate program, Phase 1: identity, attribution, area gate.
--
-- Affiliates are external partners (app_role 'affiliate', added in 0025) who
-- refer clients for a commission. This adds their identity + config, an isolated
-- tax-id store, deal/event attribution, and a new 'affiliates' internal area.
-- Commissions/payouts (P2), documents/e-sign (P3), and the affiliate portal +
-- full row-ownership (P4) build on this.

-- (1) Status enum.
create type public.affiliate_status as enum ('active', 'inactive');

-- (2) Affiliate identity. name/email/phone live on the linked profile; this row
-- holds the per-affiliate commission rate (default 15%) + status.
create table public.affiliates (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null unique references public.profiles(id) on delete cascade,
  commission_rate numeric(5, 4) not null default 0.15
                    check (commission_rate >= 0 and commission_rate <= 1),
  status          public.affiliate_status not null default 'active',
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index affiliates_profile_id_idx on public.affiliates (profile_id);
create index affiliates_created_by_idx on public.affiliates (created_by);

create trigger set_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

-- (3) Isolated OPTIONAL tax id (EIN only — never SSN). Super-admin-only at the
-- RLS level; create/update actions write it through the service-role client so
-- it is never readable by the portal or ordinary staff.
create table public.affiliate_private (
  affiliate_id uuid primary key references public.affiliates(id) on delete cascade,
  ein          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger set_updated_at
  before update on public.affiliate_private
  for each row execute function public.set_updated_at();

-- (4) current_affiliate_id(): the affiliate row for the caller, else null.
-- SECURITY DEFINER so it reads affiliates without tripping the owner-scoped RLS
-- below (which would otherwise recurse).
create or replace function public.current_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id from public.affiliates a where a.profile_id = (select auth.uid());
$$;
revoke execute on function public.current_affiliate_id() from public, anon;
grant execute on function public.current_affiliate_id() to authenticated;

-- (5) Attribution: which affiliate sourced a deal (lead), carried to its event.
alter table public.deals
  add column affiliate_id uuid references public.affiliates(id) on delete set null;
alter table public.events
  add column affiliate_id uuid references public.affiliates(id) on delete set null;
create index deals_affiliate_id_idx  on public.deals (affiliate_id);
create index events_affiliate_id_idx on public.events (affiliate_id);

-- (6) New 'affiliates' area. Extend the permission CHECK + both access helpers.
alter table public.user_module_permissions
  drop constraint user_module_permissions_module_check;
alter table public.user_module_permissions
  add constraint user_module_permissions_module_check
  check (module in ('dashboard', 'crm', 'quotes', 'events', 'inventory',
                    'scheduling', 'vendors', 'servicing', 'accounting', 'affiliates'));

create or replace function public.can_view_module(m text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when p.id is null or not p.is_active then false
    when p.is_super_admin then true
    when ov.user_id is not null then (ov.can_view or ov.can_edit)
    when p.role = 'admin' then true
    when p.role = 'sales' then m in ('dashboard','crm','quotes','events','affiliates')
    when p.role = 'ops' then m in ('dashboard','events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('dashboard','accounting','events','affiliates')
    else false
  end
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid
  left join public.user_module_permissions ov on ov.user_id = u.uid and ov.module = m;
$$;

create or replace function public.can_edit_module(m text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when p.id is null or not p.is_active then false
    when p.is_super_admin then true
    when ov.user_id is not null then ov.can_edit
    when p.role = 'admin' then true
    when p.role = 'sales' then m in ('crm','quotes','events','affiliates')
    when p.role = 'ops' then m in ('events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('accounting','affiliates')
    else false
  end
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid
  left join public.user_module_permissions ov on ov.user_id = u.uid and ov.module = m;
$$;

-- (7) RLS. Staff manage affiliates via the area; an affiliate can READ ONLY
-- their OWN row (owner-scoped OR into the select). Writes stay staff-only, so an
-- affiliate can never change their own commission rate. affiliate_private is
-- super-admin-only for every command.
alter table public.affiliates enable row level security;
create policy affiliates_select on public.affiliates
  for select to authenticated
  using (public.can_view_module('affiliates') or id = public.current_affiliate_id());
create policy affiliates_write on public.affiliates
  for all to authenticated
  using (public.can_edit_module('affiliates'))
  with check (public.can_edit_module('affiliates'));

alter table public.affiliate_private enable row level security;
create policy affiliate_private_all on public.affiliate_private
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, insert, update, delete on public.affiliates to authenticated;
grant select, insert, update, delete on public.affiliate_private to authenticated;
