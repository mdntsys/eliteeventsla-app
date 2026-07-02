-- 0023 — Deals: per-deal follow-up date + retire the "Qualified" pipeline stage.
--
-- Two product changes agreed with the team:
--  (1) A per-deal follow-up DUE DATE, surfaced as its own column on the deals
--      list (between contact/company and value).
--  (2) The pipeline drops "Qualified". Any deals sitting in it move back to
--      "New Inquiry" (don't auto-advance a deal it hasn't earned), then the
--      surviving stages are renumbered to the agreed order:
--      New Inquiry > Proposal Sent > Negotiation > Won > Lost.
--
-- Safe/idempotent: the column add is IF NOT EXISTS, and the stage cleanup is a
-- no-op when "Qualified" is already gone.

alter table public.deals
  add column if not exists follow_up_date date;

do $$
declare
  qualified_id uuid;
  new_inquiry_id uuid;
begin
  select id into qualified_id
    from public.pipeline_stages
    where name = 'Qualified';

  if qualified_id is not null then
    select id into new_inquiry_id
      from public.pipeline_stages
      where name = 'New Inquiry';

    -- Reassign any deals in "Qualified" before removing it. If "New Inquiry"
    -- is somehow absent, this nulls the stage (FK is ON DELETE SET NULL) rather
    -- than leaving a dangling reference.
    update public.deals
      set stage_id = new_inquiry_id
      where stage_id = qualified_id;

    delete from public.pipeline_stages where id = qualified_id;
  end if;
end $$;

-- Renumber the surviving stages so sort_order is contiguous (no gap where
-- "Qualified" used to sit).
update public.pipeline_stages set sort_order = 1 where name = 'New Inquiry';
update public.pipeline_stages set sort_order = 2 where name = 'Proposal Sent';
update public.pipeline_stages set sort_order = 3 where name = 'Negotiation';
update public.pipeline_stages set sort_order = 4 where name = 'Won';
update public.pipeline_stages set sort_order = 5 where name = 'Lost';
