-- 0014 — Structured locations: a managed Locations list (warehouse / off-site)
-- with warehouse rows, plus per-item (bulk) and per-unit (serialized) location
-- and a per-unit image. Migrates the old free-text location.

create type public.location_kind as enum ('warehouse', 'offsite');

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  kind       public.location_kind not null default 'offsite',
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger locations_set_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

-- Rows within a warehouse location (addable as the warehouse expands).
create table public.warehouse_rows (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  label       text not null,
  created_at  timestamptz not null default now(),
  unique (location_id, label)
);
create index warehouse_rows_location_id_idx on public.warehouse_rows (location_id);

-- Bulk items carry one location; serialized items track location per unit.
alter table public.inventory_items
  add column location_id uuid references public.locations(id) on delete set null,
  add column row_id      uuid references public.warehouse_rows(id) on delete set null,
  add column section     text;

alter table public.inventory_units
  add column location_id uuid references public.locations(id) on delete set null,
  add column row_id      uuid references public.warehouse_rows(id) on delete set null,
  add column section     text,
  add column image_url   text;

-- RLS: operations module pattern.
alter table public.locations enable row level security;
alter table public.warehouse_rows enable row level security;
create policy locations_select on public.locations
  for select to authenticated using (public.current_app_role() is not null);
create policy locations_write on public.locations
  for all to authenticated
  using (public.has_any_role('ops', 'admin')) with check (public.has_any_role('ops', 'admin'));
create policy warehouse_rows_select on public.warehouse_rows
  for select to authenticated using (public.current_app_role() is not null);
create policy warehouse_rows_write on public.warehouse_rows
  for all to authenticated
  using (public.has_any_role('ops', 'admin')) with check (public.has_any_role('ops', 'admin'));
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.warehouse_rows to authenticated;

-- Seed locations + rows, and migrate the existing free-text locations.
do $$
declare
  alvy uuid; delia uuid; rowA uuid; rowB uuid; rowC uuid;
  booth uuid; backdrop uuid; props uuid; pb001 uuid; pb002 uuid;
begin
  insert into public.locations (name, kind, notes) values ('Alvy Warehouse', 'warehouse', 'Main warehouse') returning id into alvy;
  insert into public.locations (name, kind, notes) values ('Delia''s House', 'offsite', 'Off-site overflow storage') returning id into delia;
  insert into public.warehouse_rows (location_id, label) values (alvy, 'Row A') returning id into rowA;
  insert into public.warehouse_rows (location_id, label) values (alvy, 'Row B') returning id into rowB;
  insert into public.warehouse_rows (location_id, label) values (alvy, 'Row C') returning id into rowC;

  select id into booth    from public.inventory_items where sku = 'PB-PREM';
  select id into backdrop from public.inventory_items where sku = 'BKD-SEQ';
  select id into props    from public.inventory_items where sku = 'PROP-KIT';

  update public.inventory_items set location_id=alvy, row_id=rowA, section='3', location=null where id=booth;
  update public.inventory_items set location_id=alvy, row_id=rowB, section='2', location=null where id=backdrop;
  update public.inventory_items set location_id=alvy, row_id=rowC, section='1', location=null where id=props;

  select id into pb001 from public.inventory_units where asset_tag = 'PB-001';
  select id into pb002 from public.inventory_units where asset_tag = 'PB-002';
  update public.inventory_units set location_id=alvy,  row_id=rowA, section='3' where id=pb001;
  update public.inventory_units set location_id=delia, row_id=null, section=null where id=pb002;
end $$;
