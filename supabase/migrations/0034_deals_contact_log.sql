-- 0034 — Deals: a contact-attempt counter + last-contacted date.
--
-- Product intent: keep the pipeline to leads we can still push to a booking.
-- A rep logs a touch each time they chase a lead; once the attempts stack up
-- and the follow-up date has gone by, the dashboard surfaces the deal as stale
-- so it can be marked lost or removed instead of quietly filling the board.
--
--  * contact_attempts  — how many times we've reached out. NOT NULL default 0 so
--    every existing deal starts honest at zero and the dashboard can sort on it.
--  * last_contacted_at — a plain DATE (no wall-clock time matters here), written
--    by "Log a touch" using the Pacific business day.
--
-- Safe/idempotent: both adds are IF NOT EXISTS and the constraint is guarded.

alter table public.deals
  add column if not exists contact_attempts integer not null default 0,
  add column if not exists last_contacted_at date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deals_contact_attempts_nonneg'
  ) then
    alter table public.deals
      add constraint deals_contact_attempts_nonneg check (contact_attempts >= 0);
  end if;
end $$;

-- The dashboard's two new reads (follow-ups due, stale leads) both scan *open*
-- deals by follow-up date. A partial index keeps them off a seq scan as the
-- pipeline grows, and stays small because won/lost deals are excluded.
create index if not exists deals_open_follow_up_idx
  on public.deals (follow_up_date)
  where status = 'open';
