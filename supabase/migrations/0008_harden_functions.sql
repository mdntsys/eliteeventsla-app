-- 0008 — Harden functions flagged by the Supabase security advisor.

-- set_updated_at had a mutable search_path (only references now() / pg_catalog).
alter function public.set_updated_at() set search_path = '';

-- Trigger-only functions must never be callable via the PostgREST RPC API.
-- Triggers still fire regardless of EXECUTE grants, so revoking is safe.
revoke all on function public.set_updated_at()            from public, anon, authenticated;
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.protect_profile_privileges() from public, anon, authenticated;

-- RLS helper functions are evaluated inside policies at query time, so the
-- `authenticated` role must keep EXECUTE. `anon` never needs them (every policy
-- targets `authenticated`), so drop anon/public access to remove the RPC surface.
revoke all on function public.current_app_role()              from public, anon;
revoke all on function public.is_admin()                      from public, anon;
revoke all on function public.has_any_role(public.app_role[]) from public, anon;

grant execute on function public.current_app_role()              to authenticated;
grant execute on function public.is_admin()                      to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
