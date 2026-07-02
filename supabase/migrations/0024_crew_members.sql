-- 0024 — Lightweight crew members (non-login) + assign them to schedule stops.
--
-- The team works events with people who don't need app logins. Model them as
-- crew_members (name + phone), addable inline from the crew picker — just like
-- adding a contact from a deal. Extend schedule_assignments so a stop's crew can
-- be EITHER a staff profile OR a crew member (exactly one).

create table if not exists public.crew_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.crew_members
  for each row execute function public.set_updated_at();

alter table public.crew_members enable row level security;

-- Crew is a scheduling concept: same area gate as schedule_assignments (0020).
create policy crew_members_select on public.crew_members
  for select to authenticated
  using (public.can_view_module('scheduling'));
create policy crew_members_write on public.crew_members
  for all to authenticated
  using (public.can_edit_module('scheduling'))
  with check (public.can_edit_module('scheduling'));

-- schedule_assignments: allow a crew member as an alternative to a staff profile.
alter table public.schedule_assignments
  add column if not exists crew_member_id uuid
    references public.crew_members(id) on delete cascade;

alter table public.schedule_assignments
  alter column profile_id drop not null;

-- Exactly one assignee: a staff profile OR a crew member, never both/neither.
alter table public.schedule_assignments
  add constraint schedule_assignments_one_assignee
  check (num_nonnulls(profile_id, crew_member_id) = 1);

-- Don't double-assign the same crew member to the same stop (mirrors the
-- existing unique on (schedule_entry_id, profile_id); NULLs are distinct so the
-- profile unique keeps working for crew rows).
create unique index if not exists schedule_assignments_entry_crew_key
  on public.schedule_assignments (schedule_entry_id, crew_member_id)
  where crew_member_id is not null;
