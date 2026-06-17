-- 0002 — CRM: companies, contacts, pipeline stages, deals, activities.

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  industry      text,
  website       text,
  phone         text,
  email         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text,
  notes         text,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete set null,
  first_name  text not null,
  last_name   text,
  email       text,
  phone       text,
  title       text,
  source      text,
  notes       text,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index contacts_company_id_idx on public.contacts (company_id);
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pipeline_stages (config; seeded in seed.sql)
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- deals (pipeline opportunities; a won deal becomes an event)
-- ---------------------------------------------------------------------------
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  contact_id          uuid references public.contacts(id) on delete set null,
  company_id          uuid references public.companies(id) on delete set null,
  stage_id            uuid references public.pipeline_stages(id) on delete set null,
  status              public.deal_status not null default 'open',
  estimated_value     numeric(12,2),
  expected_event_date date,
  event_type          public.event_type,
  source              text,
  notes               text,
  owner_id            uuid references public.profiles(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index deals_stage_id_idx on public.deals (stage_id);
create index deals_contact_id_idx on public.deals (contact_id);
create index deals_company_id_idx on public.deals (company_id);
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- activities (activity log + follow-ups/tasks; polymorphic links).
-- event_id's FK is added in 0004 once public.events exists.
-- ---------------------------------------------------------------------------
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  type          public.activity_type not null default 'note',
  subject       text,
  body          text,
  due_at        timestamptz,
  completed_at  timestamptz,
  assigned_to   uuid references public.profiles(id) on delete set null,
  contact_id    uuid references public.contacts(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  deal_id       uuid references public.deals(id) on delete cascade,
  event_id      uuid,  -- FK added in 0004
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index activities_contact_id_idx on public.activities (contact_id);
create index activities_deal_id_idx on public.activities (deal_id);
create index activities_due_at_idx on public.activities (due_at);
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();
