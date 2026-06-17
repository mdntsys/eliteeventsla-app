-- 0005 — Vendor network (categories, vendors, event↔vendor ties) and client
-- servicing tickets.

-- ---------------------------------------------------------------------------
-- vendor_categories (config; seeded in seed.sql)
-- ---------------------------------------------------------------------------
create table public.vendor_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vendors — external network (food, drink, catering, entertainment, ...).
-- ---------------------------------------------------------------------------
create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category_id   uuid references public.vendor_categories(id) on delete set null,
  contact_name  text,
  email         text,
  phone         text,
  website       text,
  address       text,
  rating        numeric(2,1),
  preferred     boolean not null default false,
  status        public.vendor_status not null default 'active',
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint vendors_rating_range check (rating is null or (rating >= 0 and rating <= 5))
);
create index vendors_category_id_idx on public.vendors (category_id);
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_vendors — which vendors are tied to which events.
-- ---------------------------------------------------------------------------
create table public.event_vendors (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  vendor_id   uuid not null references public.vendors(id) on delete cascade,
  service     text,
  agreed_cost numeric(10,2),
  status      public.event_vendor_status not null default 'proposed',
  notes       text,
  created_at  timestamptz not null default now(),
  unique (event_id, vendor_id)
);
create index event_vendors_event_id_idx on public.event_vendors (event_id);
create index event_vendors_vendor_id_idx on public.event_vendors (vendor_id);

-- ---------------------------------------------------------------------------
-- service_tickets — client servicing, optionally tied to an event/contact.
-- ---------------------------------------------------------------------------
create table public.service_tickets (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid references public.events(id) on delete set null,
  contact_id   uuid references public.contacts(id) on delete set null,
  subject      text not null,
  description  text,
  priority     public.ticket_priority not null default 'medium',
  status       public.ticket_status not null default 'open',
  assigned_to  uuid references public.profiles(id) on delete set null,
  resolved_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index service_tickets_status_idx on public.service_tickets (status);
create index service_tickets_event_id_idx on public.service_tickets (event_id);
create trigger service_tickets_set_updated_at
  before update on public.service_tickets
  for each row execute function public.set_updated_at();
