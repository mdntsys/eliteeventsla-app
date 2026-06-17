-- 0003 — Inventory (hybrid): categories, items (bulk + serialized),
-- per-unit serialized assets, and maintenance records.

-- ---------------------------------------------------------------------------
-- inventory_categories (config; seeded in seed.sql)
-- ---------------------------------------------------------------------------
create table public.inventory_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory_items — `kind` = 'bulk' uses `quantity`; 'serialized' is tracked
-- per-unit in inventory_units.
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.inventory_categories(id) on delete set null,
  sku              text unique,
  name             text not null,
  description      text,
  kind             public.inventory_kind not null default 'bulk',
  quantity         integer not null default 0,   -- meaningful for bulk items
  daily_rate       numeric(10,2),
  replacement_cost numeric(10,2),
  status           public.item_status not null default 'available',
  location         text,
  image_url        text,
  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint inventory_items_quantity_nonneg check (quantity >= 0)
);
create index inventory_items_category_id_idx on public.inventory_items (category_id);
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_units — individual serialized machines/assets.
-- ---------------------------------------------------------------------------
create table public.inventory_units (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.inventory_items(id) on delete cascade,
  asset_tag       text unique,
  serial_number   text,
  status          public.unit_status not null default 'available',
  condition_notes text,
  acquired_on     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index inventory_units_item_id_idx on public.inventory_units (item_id);
create trigger inventory_units_set_updated_at
  before update on public.inventory_units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- maintenance_records — tied to a bulk item OR a specific serialized unit.
-- ---------------------------------------------------------------------------
create table public.maintenance_records (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references public.inventory_items(id) on delete cascade,
  unit_id       uuid references public.inventory_units(id) on delete cascade,
  reported_at   timestamptz not null default now(),
  issue         text not null,
  status        public.maintenance_status not null default 'open',
  cost          numeric(10,2),
  performed_by  uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint maintenance_has_target check (item_id is not null or unit_id is not null)
);
create index maintenance_item_id_idx on public.maintenance_records (item_id);
create index maintenance_unit_id_idx on public.maintenance_records (unit_id);
create trigger maintenance_set_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();
