-- 0038 — Undo 0036 where it overreached: payment LINK rows are not abandoned.
--
-- 0036 retired "pending stripe rows with no payment intent, older than 24h" on
-- the reasoning that a Stripe Checkout Session expires after 24 hours. That
-- reasoning holds only for CHECKOUT SESSIONS. A Stripe PAYMENT LINK row matches
-- the same predicate (method 'stripe', status 'pending', no intent — the intent
-- doesn't exist until someone pays) but a payment link NEVER expires and stays
-- payable indefinitely, so 0036 cancelled at least one live, collectable link.
--
-- Cancelling a link row has two knock-on effects, which is why this matters
-- beyond cosmetics:
--   * ensurePaymentLink reuses an existing *pending* link row; with the row
--     cancelled it mints a duplicate link for the same invoice.
--   * voiding an invoice deactivates links found via that same pending filter,
--     so a cancelled row leaves a live payable link behind after the void.
--
-- Restores anything 0036 mislabelled: cancelled + has a payment-link id + never
-- had a checkout session. Genuine abandoned sessions (which carry a session id)
-- are left cancelled. No money moves either way — amount_paid counts 'succeeded'
-- only. The code paths were narrowed in the same change to filter on
-- `stripe_checkout_session_id is not null`, so this cannot recur.

update public.payments
   set status = 'pending',
       notes = nullif(
         replace(
           coalesce(notes, ''),
           ' — abandoned (session expired, never completed)',
           ''
         ),
         ''
       ),
       updated_at = now()
 where method = 'stripe'
   and status = 'cancelled'
   and stripe_payment_link_id is not null
   and stripe_checkout_session_id is null;
