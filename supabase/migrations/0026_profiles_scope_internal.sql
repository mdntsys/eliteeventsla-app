-- 0026 — Security foundation for external (affiliate) logins.
--
-- Problem: profiles_select is `using (true)` — EVERY authenticated user can read
-- EVERY profile row (the whole staff directory). That is fine while all logins
-- are internal staff, but the moment external affiliates get logins they would
-- read the entire team. Tighten it BEFORE any affiliate exists.
--
-- is_internal_user(): true iff the caller is an active internal staff member
-- (super-admin, or one of the four business roles) — i.e. NOT an affiliate.
-- For every current user this is true, so this migration changes nothing for
-- existing staff; it only pre-scopes reads for the affiliate role added in 0025.

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and (p.is_super_admin or p.role in ('admin', 'sales', 'ops', 'accounting'))
  );
$$;

revoke execute on function public.is_internal_user() from public, anon;
grant execute on function public.is_internal_user() to authenticated;

-- Internal staff read the full directory (unchanged); anyone else (an affiliate)
-- can read only their own profile row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_internal_user() or id = (select auth.uid()));
