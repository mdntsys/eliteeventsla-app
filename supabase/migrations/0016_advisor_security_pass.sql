-- 0016 — Security/perf advisor pass (Supabase database linter).
-- Two clean, additive policy fixes; everything else the linter flagged is
-- accept-by-design (RLS helper functions must stay executable; per-table
-- _select/_write policy consolidation is too broad to churn safely) or a
-- dashboard toggle (leaked-password protection) tracked as a human action.

-- 1) lint 0025_public_bucket_allows_listing
--    The public 'inventory-photos' bucket had a broad SELECT policy on
--    storage.objects, letting any authenticated client LIST/enumerate every
--    uploaded file. The app only ever reads these images through public object
--    URLs (getPublicUrl), which do NOT consult this policy, so the policy adds
--    no functionality and only enables enumeration. Drop it. Object content
--    stays reachable by public URL; the ops/admin insert/update/delete policies
--    are independent and unaffected.
drop policy if exists "inv_photos_select" on storage.objects;

-- 2) lint 0003_auth_rls_initplan
--    profiles_update re-evaluated auth.uid()/is_admin() once per row. Wrap them
--    in scalar subqueries so the planner evaluates each once per statement.
--    Semantics are identical to the original policy.
alter policy profiles_update on public.profiles
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
