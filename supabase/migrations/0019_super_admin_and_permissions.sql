-- 0019 — Super-admin tier + per-user module permissions (View/Edit)
--
-- Adds a SUPER ADMIN tier above 'admin' and per-user, per-area View/Edit overrides.
-- Model:
--   * is_super_admin (profiles flag) = full access + the ONLY tier that manages people
--     (roles, super-admin status, is_active) and per-user permissions.
--   * role='admin' = full business access, but NO people management.
--   * user_module_permissions = per-user, per-area overrides. Absent row = full access
--     (role-preset default); present row = explicit grant → "start full, dial back".
-- Enforcement here is at the data/trigger layer for PEOPLE management; per-area
-- view-hiding for business tables (RLS SELECT rewrite) lands in a later migration —
-- the app layer enforces View/Edit in the meantime.

-- (1) Super-admin flag.
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- (2) Per-user, per-area View/Edit overrides (the Team-console matrix).
create table if not exists public.user_module_permissions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  module     text not null check (module in
    ('dashboard','crm','quotes','events','inventory','scheduling','vendors','servicing','accounting')),
  can_view   boolean not null default true,
  can_edit   boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, module)
);
create index if not exists user_module_permissions_user_idx
  on public.user_module_permissions (user_id);
alter table public.user_module_permissions enable row level security;

-- (3) is_super_admin() — current user is an active super admin.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;
revoke execute on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- (4) is_admin() now also true for super admins (so existing admin-only checks cover them).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select role = 'admin' or is_super_admin from public.profiles where id = auth.uid() and is_active),
    false
  );
$$;

-- (5) Permissions-table RLS: read your own grants; super admins read/write everyone's.
drop policy if exists ump_select on public.user_module_permissions;
create policy ump_select on public.user_module_permissions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists ump_write on public.user_module_permissions;
create policy ump_write on public.user_module_permissions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- (6) People management becomes SUPER-ADMIN-ONLY (was admin). Everyone may still edit
--     their OWN profile (name/phone/avatar); the trigger blocks privilege-column changes.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_super_admin())
  with check (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only a super admin can change a role';
  end if;
  if new.is_super_admin is distinct from old.is_super_admin and not public.is_super_admin() then
    raise exception 'Only a super admin can change super-admin status';
  end if;
  if new.is_active is distinct from old.is_active and not public.is_super_admin() then
    raise exception 'Only a super admin can change active status';
  end if;
  return new;
end;
$$;

-- (7) Bootstrap the break-glass super admin (the existing admin account), trigger-bypassed
--     so there is never a window with zero super admins. Idempotent; no-op if the row is absent.
alter table public.profiles disable trigger profiles_protect_privileges;
update public.profiles set is_super_admin = true
  where email = 'nic@midnitesystems.com';
alter table public.profiles enable trigger profiles_protect_privileges;
