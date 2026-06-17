import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client using the service-role key. This BYPASSES RLS, so
 * it must never be imported into a Client Component or exposed to the browser.
 * The key lives in SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC prefix).
 *
 * Use only where a trusted server context must write data the signed-in user
 * couldn't write under RLS — e.g. the Stripe webhook updating payment status.
 * Lazily constructed so a missing key never breaks the build.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
