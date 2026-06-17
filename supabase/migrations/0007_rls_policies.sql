-- 0007 — Row Level Security, keyed on role.
--
-- Model: any authenticated user WITH an assigned role can READ business data;
-- WRITES are gated per module; admin can do everything. This mirrors
-- src/lib/auth/roles.ts. Tighten to per-owner row security later as needed.

do $$
declare
  t text;
  all_data text[] := array[
    'companies','contacts','deals','activities',
    'inventory_items','inventory_units','maintenance_records',
    'events','event_items','schedule_entries','schedule_assignments',
    'vendors','event_vendors','service_tickets',
    'invoices','invoice_line_items','payments',
    'pipeline_stages','inventory_categories','vendor_categories'
  ];
  crm text[]    := array['companies','contacts','deals','activities'];
  ops text[]    := array['inventory_items','inventory_units','maintenance_records',
                         'events','event_items','schedule_entries','schedule_assignments',
                         'vendors','event_vendors','service_tickets'];
  acct text[]   := array['invoices','invoice_line_items','payments'];
  config text[] := array['pipeline_stages','inventory_categories','vendor_categories'];
begin
  -- Enable RLS + broad read (any user with a non-NULL role) on all data tables.
  foreach t in array all_data loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (public.current_app_role() is not null);',
      t || '_select', t
    );
  end loop;

  -- CRM writes: sales + admin.
  foreach t in array crm loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.has_any_role(''sales'',''admin'')) '
      'with check (public.has_any_role(''sales'',''admin''));',
      t || '_write', t
    );
  end loop;

  -- Operations writes: ops + admin.
  foreach t in array ops loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.has_any_role(''ops'',''admin'')) '
      'with check (public.has_any_role(''ops'',''admin''));',
      t || '_write', t
    );
  end loop;

  -- Accounting writes: accounting + admin.
  foreach t in array acct loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.has_any_role(''accounting'',''admin'')) '
      'with check (public.has_any_role(''accounting'',''admin''));',
      t || '_write', t
    );
  end loop;

  -- Config tables: admin-only writes.
  foreach t in array config loop
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin());',
      t || '_write', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Everyone signed in can read the team directory — and crucially their OWN row
-- even while role is still NULL (the app shell needs it to show the pending state).
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- Update own row; admins update anyone. The protect_profile_privileges trigger
-- blocks non-admins from changing role / is_active.
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin on public.profiles
  for insert to authenticated with check (public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- stripe_webhook_events — RLS on, NO policies. Only the service-role webhook
-- (which bypasses RLS) ever touches it.
-- ---------------------------------------------------------------------------
alter table public.stripe_webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase configures default privileges for new tables, but we
-- set them explicitly so the security model is self-documenting. Only the
-- `authenticated` role is used by the app (anon is never granted table access;
-- service_role bypasses RLS). RLS still gates every row above.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Defense in depth: the webhook audit table is service-role only.
revoke all on public.stripe_webhook_events from authenticated;
