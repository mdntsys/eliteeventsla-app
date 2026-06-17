-- 0013 — Capture when the event actually ran (vs the planned start_at/end_at),
-- set by the crew on-site. No new tables/tabs; two columns on events.

alter table public.events
  add column actual_start_at timestamptz,
  add column actual_end_at   timestamptz;
