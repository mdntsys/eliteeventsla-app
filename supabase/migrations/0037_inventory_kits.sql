-- 0037 — Inventory bundles ("kits"): a named, located set of items pulled as one.
--
-- Operationally the warehouse is being split into two ready-to-go photo booth
-- pallets. A crew member should be told "take Photo Booth A", walk to that
-- pallet, and load it — not read a 30-line pick list and dig through bins. And
-- booking a job should reserve the whole pallet in one action instead of
-- reserving thirty items by hand.
--
-- Shape notes:
--  * A kit carries its own LOCATION so the pick instruction is "Photo Booth A —
--    Warehouse, Row 3" without inferring it from the items inside (which may be
--    stored loose elsewhere).
--  * A kit line is (item, quantity) — NOT one row per physical thing. Almost all
--    of this inventory is bulk with a quantity, so a 20-count box of boa scarves
--    splits as 10 to Kit A and 10 to Kit B: the SAME item_id appears in both
--    kits with different quantities. The partial unique indexes below allow
--    exactly that while still stopping the same item being listed twice in one
--    kit.
--  * unit_id pins a specific serialized asset to a kit (Booth A's actual
--    machine), and is null for bulk lines.
--
-- Reserving a kit explodes it into ordinary event_items rows rather than
-- introducing a second reservation concept — so availability maths, the
-- double-booking EXCLUDE guard, the pick list, and check-out/return all keep
-- working untouched.

create table public.inventory_kits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  -- Where the assembled bundle physically lives (the pallet).
  location_id uuid references public.locations(id) on delete set null,
  row_id      uuid references public.warehouse_rows(id) on delete set null,
  section     text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index inventory_kits_location_id_idx on public.inventory_kits (location_id);
create trigger inventory_kits_set_updated_at
  before update on public.inventory_kits
  for each row execute function public.set_updated_at();

create table public.inventory_kit_items (
  id         uuid primary key default gen_random_uuid(),
  kit_id     uuid not null references public.inventory_kits(id) on delete cascade,
  item_id    uuid not null references public.inventory_items(id) on delete cascade,
  -- Set only for a serialized asset pinned to this kit; null for bulk lines.
  unit_id    uuid references public.inventory_units(id) on delete cascade,
  quantity   integer not null default 1,
  notes      text,
  created_at timestamptz not null default now(),
  constraint inventory_kit_items_quantity_positive check (quantity > 0),
  -- A pinned unit is always exactly one thing.
  constraint inventory_kit_items_unit_quantity
    check (unit_id is null or quantity = 1)
);
create index inventory_kit_items_kit_id_idx on public.inventory_kit_items (kit_id);
create index inventory_kit_items_item_id_idx on public.inventory_kit_items (item_id);
create index inventory_kit_items_unit_id_idx on public.inventory_kit_items (unit_id);

-- One bulk line per item per kit (adjust the quantity instead of adding a
-- second row), and a given serialized unit can only be pinned to one kit line.
-- Two partial indexes rather than one UNIQUE(kit_id,item_id,unit_id), because
-- Postgres treats NULLs as distinct and that would let bulk lines duplicate.
create unique index inventory_kit_items_bulk_uniq
  on public.inventory_kit_items (kit_id, item_id)
  where unit_id is null;
create unique index inventory_kit_items_unit_uniq
  on public.inventory_kit_items (unit_id)
  where unit_id is not null;

-- RLS: same area gate as the rest of inventory (see 0020).
alter table public.inventory_kits enable row level security;
alter table public.inventory_kit_items enable row level security;

create policy inventory_kits_select on public.inventory_kits
  for select to authenticated using (public.can_view_module('inventory'));
create policy inventory_kits_write on public.inventory_kits
  for all to authenticated
  using (public.can_edit_module('inventory'))
  with check (public.can_edit_module('inventory'));

create policy inventory_kit_items_select on public.inventory_kit_items
  for select to authenticated using (public.can_view_module('inventory'));
create policy inventory_kit_items_write on public.inventory_kit_items
  for all to authenticated
  using (public.can_edit_module('inventory'))
  with check (public.can_edit_module('inventory'));

-- Seed the two pallets the warehouse is being split into, so they're ready to
-- fill in. Idempotent, and empty — items get assigned from the inventory list.
insert into public.inventory_kits (name, description, sort_order)
values
  ('Photo Booth A', 'Complete booth pallet — everything needed to run one job.', 1),
  ('Photo Booth B', 'Complete booth pallet — everything needed to run one job.', 2)
on conflict (name) do nothing;
