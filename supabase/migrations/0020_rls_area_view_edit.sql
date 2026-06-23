-- 0020 — DB-level per-area View/Edit RLS (the fast-follow to 0019's app-layer enforcement)
--
-- Replaces the uniform "any active role reads everything" SELECT policies + coarse
-- role-group write policies with per-AREA checks:
--   READ  = can_view_module(area)
--   WRITE = can_edit_module(area)
-- Effective access per the 0019 model: super_admin -> full; else explicit
-- user_module_permissions override; else the role preset default (admin = all).
-- Config tables (pipeline_stages, *_categories), profiles, user_module_permissions,
-- and stripe_webhook_events are intentionally NOT area-gated and are left untouched.

-- (1) Effective-access helpers. SQL + STABLE so a constant area arg is evaluated
--     once per query (fast in RLS). SECURITY DEFINER to read profiles + overrides.
create or replace function public.can_view_module(m text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when p.id is null or not p.is_active then false
    when p.is_super_admin then true
    when ov.user_id is not null then (ov.can_view or ov.can_edit)
    when p.role = 'admin' then true
    when p.role = 'sales' then m in ('dashboard','crm','quotes','events')
    when p.role = 'ops' then m in ('dashboard','events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('dashboard','accounting','events')
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
    when p.role = 'sales' then m in ('crm','quotes','events')
    when p.role = 'ops' then m in ('events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('accounting')
    else false
  end
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid
  left join public.user_module_permissions ov on ov.user_id = u.uid and ov.module = m;
$$;

revoke execute on function public.can_view_module(text) from public, anon;
revoke execute on function public.can_edit_module(text) from public, anon;
grant execute on function public.can_view_module(text) to authenticated;
grant execute on function public.can_edit_module(text) to authenticated;

-- (2) Rewrite each business table's policies to its area. The _select policy gates
--     reads by can_view; the _write (FOR ALL) policy gates writes by can_edit — and
--     since can_edit implies can_view, the OR of the two leaves reads = can_view.
do $$
declare
  m record;
  pol record;
begin
  for m in
    select * from (values
      ('companies','crm'), ('contacts','crm'), ('deals','crm'), ('activities','crm'),
      ('quotes','quotes'), ('quote_line_items','quotes'),
      ('events','events'), ('event_attachments','events'),
      ('event_items','inventory'),
      ('inventory_items','inventory'), ('inventory_units','inventory'),
      ('maintenance_records','inventory'), ('locations','inventory'), ('warehouse_rows','inventory'),
      ('schedule_entries','scheduling'), ('schedule_assignments','scheduling'),
      ('vendors','vendors'), ('event_vendors','vendors'),
      ('service_tickets','servicing'), ('ticket_comments','servicing'),
      ('invoices','accounting'), ('invoice_line_items','accounting'), ('payments','accounting')
    ) as t(tbl, area)
  loop
    -- Drop whatever policies currently exist on the table (clean slate).
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = m.tbl loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, m.tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_view_module(%L))',
      m.tbl || '_select', m.tbl, m.area);

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_edit_module(%L)) with check (public.can_edit_module(%L))',
      m.tbl || '_write', m.tbl, m.area, m.area);
  end loop;
end $$;
