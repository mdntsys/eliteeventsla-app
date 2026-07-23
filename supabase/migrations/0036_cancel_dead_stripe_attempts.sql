-- 0036 — Retire the abandoned Stripe checkout attempts already in the table.
--
-- Companion to 0035. Every "Pay" click created a pending payments row; the ones
-- the payer never completed have been accumulating since June and show up on the
-- invoice as pending money. This clears the ones that are dead by definition.
--
-- The rule is deliberately airtight rather than a judgement call:
--   * method = 'stripe' and status = 'pending'  — an in-flight hosted checkout
--   * stripe_payment_intent_id IS NULL          — never got as far as a charge,
--     so this is NOT a slow ACH/bank debit still settling (those carry an intent)
--   * created_at < now() - 24h                  — a Stripe Checkout Session
--     expires 24 hours after creation, so past that it can never complete
--
-- Nothing here touches amount_paid or invoice status: reconcile sums only
-- 'succeeded' payments, so these rows were already worth $0. This only stops
-- them from reading as outstanding.

update public.payments
   set status = 'cancelled',
       notes  = coalesce(nullif(notes, ''), 'Stripe checkout')
                || ' — abandoned (session expired, never completed)',
       updated_at = now()
 where method = 'stripe'
   and status = 'pending'
   and stripe_payment_intent_id is null
   and created_at < now() - interval '24 hours';
