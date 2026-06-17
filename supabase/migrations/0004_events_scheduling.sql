-- 0004 — Events/Jobs (central operational record), reserved inventory line
-- items, scheduling entries, and staff assignments.

-- ---------------------------------------------------------------------------
-- events — created from a won deal; ties together inventory, scheduling,
-- vendors, and billing.
-- ---------------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  deal_id       uuid references public.deals(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete set null,
  company_id    uuid references public.companies(id) on delete set null,
  event_type    public.event_type not null default 'other',
  status        public.event_status not null default 'draft',
  event_date    date,
  start_at      timestamptz,
  end_at        timestamptz,
  venue_name    text,
  venue_address text,
  guest_count   integer,
  total_amount  numeric(12,2),
  notes         text,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index events_status_idx on public.events (status);
create index events_event_date_idx on public.events (event_date);
create index events_deal_id_idx on public.events (deal_id);
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Now that events exists, wire the deferred activities.event_id FK (see 0002).
alter table public.activities
  add constraint activities_event_id_fkey
  foreign key (event_id) references public.events(id) on delete cascade;
create index activities_event_id_idx on public.activities (event_id);

-- ---------------------------------------------------------------------------
-- event_items — reserved inventory for an event. Drives availability:
-- compare summed reserved quantity over overlapping [reserved_from, reserved_to]
-- windows against inventory_items.quantity (bulk) or unit status (serialized).
-- ---------------------------------------------------------------------------
create table public.event_items (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  unit_id           uuid references public.inventory_units(id) on delete set null,
  quantity          integer not null default 1,
  rate              numeric(10,2),
  reserved_from     timestamptz,
  reserved_to       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  constraint event_items_quantity_positive check (quantity > 0)
);
create index event_items_event_id_idx on public.event_items (event_id);
create index event_items_inventory_item_id_idx on public.event_items (inventory_item_id);
create index event_items_unit_id_idx on public.event_items (unit_id);

-- ---------------------------------------------------------------------------
-- schedule_entries — deliveries, pickups, setups, teardowns, site visits.
-- ---------------------------------------------------------------------------
create table public.schedule_entries (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  type            public.schedule_type not null default 'delivery',
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  status          public.schedule_status not null default 'scheduled',
  address         text,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index schedule_entries_event_id_idx on public.schedule_entries (event_id);
create index schedule_entries_start_idx on public.schedule_entries (scheduled_start);
create trigger schedule_entries_set_updated_at
  before update on public.schedule_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- schedule_assignments — staff (profiles) assigned to a schedule entry.
-- ---------------------------------------------------------------------------
create table public.schedule_assignments (
  id                 uuid primary key default gen_random_uuid(),
  schedule_entry_id  uuid not null references public.schedule_entries(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  role_on_job        text,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (schedule_entry_id, profile_id)
);
create index schedule_assignments_profile_id_idx on public.schedule_assignments (profile_id);
