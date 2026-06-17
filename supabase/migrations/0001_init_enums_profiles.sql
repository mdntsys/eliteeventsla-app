-- 0001 — Enums, profiles, role helpers, and core triggers.
-- Foundation for the Elite Events LA Operations OS. RLS is added in 0007.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'sales', 'ops', 'accounting');
create type public.deal_status as enum ('open', 'won', 'lost');
create type public.activity_type as enum ('call', 'email', 'meeting', 'note', 'task');
create type public.event_type as enum ('corporate', 'wedding', 'personal', 'other');
create type public.event_status as enum ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled');
create type public.inventory_kind as enum ('bulk', 'serialized');
create type public.item_status as enum ('available', 'maintenance', 'retired');
create type public.unit_status as enum ('available', 'reserved', 'in_use', 'maintenance', 'retired');
create type public.maintenance_status as enum ('open', 'in_progress', 'resolved');
create type public.schedule_type as enum ('delivery', 'pickup', 'setup', 'teardown', 'site_visit', 'other');
create type public.schedule_status as enum ('scheduled', 'en_route', 'in_progress', 'completed', 'cancelled');
create type public.vendor_status as enum ('active', 'inactive');
create type public.event_vendor_status as enum ('proposed', 'confirmed', 'declined');
create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.invoice_status as enum ('draft', 'sent', 'partial', 'paid', 'overdue', 'void');
create type public.payment_method as enum ('card', 'cash', 'check', 'bank_transfer', 'stripe');
create type public.payment_status as enum ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- updated_at trigger function (reused by every mutable table)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users. role is NULL until an admin assigns one.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        public.app_role,             -- NULL = pending, no data access
  phone       text,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth user → profile row (role NULL, pending admin assignment).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they bypass profiles RLS (no recursion).
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) = 'admin',
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
    (select role from public.profiles where id = auth.uid()) = any (roles),
    false
  );
$$;

-- Prevent non-admins from escalating their own role / reactivating themselves.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change a role';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only an admin can change active status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
