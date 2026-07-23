-- 0035 — payment_status gains 'cancelled'.
--
-- Why: opening Stripe Checkout creates a `pending` payments row. If the payer
-- closes the tab instead of paying, Stripe never sends a completion event, so
-- that row sat at 'pending' forever — an invoice that was fully paid still
-- showed "$100.00 Pending" next to the real payment, reading as money owed.
--
-- 'failed' is the wrong word for it (nothing was declined) and 'refunded' is
-- worse, so abandoned/expired checkout attempts get their own terminal status.
-- Like 'failed', it is NOT counted toward amount_paid — reconcile only ever
-- sums 'succeeded' — so this is a labelling fix, never a money change.
--
-- Split from the backfill (0036) on purpose: Postgres will not let a newly
-- added enum value be USED in the same transaction that adds it.

alter type public.payment_status add value if not exists 'cancelled';
