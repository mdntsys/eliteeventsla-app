-- 0009 — Fixes from the foundation security/integrity review.

-- (1) Enforce is_active in the RLS helpers. A deactivated user (is_active=false)
-- now resolves to no role: current_app_role() -> NULL (read policies fail),
-- is_admin()/has_any_role() -> false (write policies fail). Offboarding by
-- setting is_active=false now actually revokes all data access.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and is_active) = 'admin',
    false
  );
$$;

create or replace function public.has_any_role(variadic roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and is_active) = any (roles),
    false
  );
$$;

-- CREATE OR REPLACE keeps existing ACLs, but re-assert them to stay deterministic.
revoke all on function public.current_app_role()              from public, anon;
revoke all on function public.is_admin()                      from public, anon;
revoke all on function public.has_any_role(public.app_role[]) from public, anon;
grant execute on function public.current_app_role()              to authenticated;
grant execute on function public.is_admin()                      to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;

-- (2) Preserve the activity/audit log when a parent record is deleted. The rest
-- of the schema uses ON DELETE SET NULL for the same intent; activities used
-- CASCADE, which silently wiped interaction history. Switch to SET NULL.
alter table public.activities drop constraint activities_contact_id_fkey;
alter table public.activities
  add constraint activities_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete set null;

alter table public.activities drop constraint activities_company_id_fkey;
alter table public.activities
  add constraint activities_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete set null;

alter table public.activities drop constraint activities_deal_id_fkey;
alter table public.activities
  add constraint activities_deal_id_fkey
  foreign key (deal_id) references public.deals(id) on delete set null;

alter table public.activities drop constraint activities_event_id_fkey;
alter table public.activities
  add constraint activities_event_id_fkey
  foreign key (event_id) references public.events(id) on delete set null;

-- (3) Align events writes with app-layer MODULE_ACCESS.events (admin, sales, ops):
-- sales creates/converts an event from a won deal, ops owns the logistics
-- (event_items, scheduling stay ops-only). Replace the ops-only events policy.
drop policy if exists events_write on public.events;
create policy events_write on public.events
  for all to authenticated
  using (public.has_any_role('sales', 'ops', 'admin'))
  with check (public.has_any_role('sales', 'ops', 'admin'));

-- (4) Protect financial reconciliation: do not let deleting an invoice/event
-- silently orphan a recorded payment. Block the delete instead (void the
-- invoice / cancel the event in app logic when appropriate).
alter table public.payments drop constraint payments_invoice_id_fkey;
alter table public.payments
  add constraint payments_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete restrict;

alter table public.payments drop constraint payments_event_id_fkey;
alter table public.payments
  add constraint payments_event_id_fkey
  foreign key (event_id) references public.events(id) on delete restrict;
