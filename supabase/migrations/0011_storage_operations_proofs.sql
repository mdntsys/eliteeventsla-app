-- 0011 — Private Storage bucket for operations photo-proof (warehouse returns,
-- delivery proof), gated by the same role model as the operations module.

insert into storage.buckets (id, name, public)
values ('operations-proofs', 'operations-proofs', false)
on conflict (id) do nothing;

-- Read: any user with an assigned role (proofs are viewed via signed URLs).
create policy "ops_proofs_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'operations-proofs' and public.current_app_role() is not null);

-- Write/replace/delete: ops + admin only.
create policy "ops_proofs_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'operations-proofs' and public.has_any_role('ops', 'admin'));

create policy "ops_proofs_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'operations-proofs' and public.has_any_role('ops', 'admin'))
  with check (bucket_id = 'operations-proofs' and public.has_any_role('ops', 'admin'));

create policy "ops_proofs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'operations-proofs' and public.has_any_role('ops', 'admin'));
