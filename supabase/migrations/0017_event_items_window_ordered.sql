-- 0017 — Reservation window integrity: a reserved window must be ordered.
--
-- The no-double-booking guard (EXCLUDE on unit_id + tstzrange overlap) already
-- exists from an earlier migration. What was missing: nothing stopped a
-- reversed window (reserved_to before reserved_from). With a unit set, such a
-- row hits the exclusion's tstzrange() expression and fails with a raw,
-- cryptic range error. Add an explicit, named CHECK so the invariant is clear
-- and the failure is a normal constraint violation; the reserve action also
-- validates this at the app layer for a friendly message before the DB is hit.
alter table public.event_items
  add constraint event_items_window_ordered
  check (
    reserved_from is null
    or reserved_to is null
    or reserved_from <= reserved_to
  );
