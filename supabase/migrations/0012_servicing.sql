-- 0012 — Servicing: ticket categories + a threaded comment log on service tickets.

create type public.ticket_category as enum (
  'delivery', 'equipment', 'billing', 'change_request', 'complaint', 'general'
);

alter table public.service_tickets
  add column category public.ticket_category not null default 'general';

-- Threaded notes / activity on a ticket (the back-and-forth, not just the row).
create table public.ticket_comments (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.service_tickets(id) on delete cascade,
  body       text not null,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id);

-- RLS: operations module pattern (read by any roled user; writes ops/admin).
alter table public.ticket_comments enable row level security;
create policy ticket_comments_select on public.ticket_comments
  for select to authenticated using (public.current_app_role() is not null);
create policy ticket_comments_write on public.ticket_comments
  for all to authenticated
  using (public.has_any_role('ops', 'admin'))
  with check (public.has_any_role('ops', 'admin'));
grant select, insert, update, delete on public.ticket_comments to authenticated;
