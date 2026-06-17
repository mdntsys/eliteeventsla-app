import Stripe from "stripe";

/**
 * SERVER-ONLY Stripe client. Lazily constructed so a missing key never breaks
 * the build (the constructor throws without a key). Uses the SDK's pinned API
 * version. STRIPE_SECRET_KEY has no NEXT_PUBLIC prefix and must stay server-side.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  _stripe = new Stripe(key);
  return _stripe;
}
