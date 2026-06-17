-- 0010 — Event/job operational lifecycle: per-line-item checkout/return,
-- return photo-proof attachments, and serialized double-booking protection.

create type public.return_condition as enum ('good', 'damaged', 'lost');
create type public.attachment_kind as enum ('return_proof', 'delivery_proof', 'other');

-- Per-line-item checkout/return lifecycle on reserved inventory.
alter table public.event_items
  add column checked_out_at   timestamptz,
  add column returned_at      timestamptz,
  add column return_condition public.return_condition,
  add column return_notes     text;

-- Photo proof (and other attachments) for a job / line item. Files live in the
-- private 'operations-proofs' Storage bucket; storage_path is the object path.
create table public.event_attachments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  event_item_id uuid references public.event_items(id) on delete set null,
  storage_path  text not null,
  kind          public.attachment_kind not null default 'return_proof',
  caption       text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index event_attachments_event_id_idx on public.event_attachments (event_id);
create index event_attachments_item_id_idx on public.event_attachments (event_item_id);

-- Prevent double-booking the same serialized unit over overlapping reservation
-- windows. (Bulk-quantity capacity is enforced in the availability layer.)
create extension if not exists btree_gist with schema extensions;
alter table public.event_items
  add constraint event_items_no_unit_overlap
  exclude using gist (
    unit_id with =,
    tstzrange(reserved_from, reserved_to) with &&
  )
  where (unit_id is not null and reserved_from is not null and reserved_to is not null);

-- RLS: operations module pattern (read by any roled user; writes ops/admin).
alter table public.event_attachments enable row level security;
create policy event_attachments_select on public.event_attachments
  for select to authenticated using (public.current_app_role() is not null);
create policy event_attachments_write on public.event_attachments
  for all to authenticated
  using (public.has_any_role('ops', 'admin'))
  with check (public.has_any_role('ops', 'admin'));
grant select, insert, update, delete on public.event_attachments to authenticated;
