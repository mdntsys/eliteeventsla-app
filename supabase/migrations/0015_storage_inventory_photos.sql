-- 0015 — Public Storage bucket for inventory photos (item + per-unit images).
-- Public read (equipment photos aren't sensitive → simple public URLs);
-- writes restricted to ops/admin.

insert into storage.buckets (id, name, public)
values ('inventory-photos', 'inventory-photos', true)
on conflict (id) do nothing;

create policy "inv_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'inventory-photos');

create policy "inv_photos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inventory-photos' and public.has_any_role('ops', 'admin'));

create policy "inv_photos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'inventory-photos' and public.has_any_role('ops', 'admin'))
  with check (bucket_id = 'inventory-photos' and public.has_any_role('ops', 'admin'));

create policy "inv_photos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventory-photos' and public.has_any_role('ops', 'admin'));
