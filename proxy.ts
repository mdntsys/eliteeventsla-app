import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed Middleware to Proxy (same purpose, now Node.js runtime).
 * This refreshes the Supabase session cookie on every request and performs the
 * optimistic auth redirect. See src/lib/supabase/middleware.ts.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except API routes (they do their own auth — and the
  // Stripe webhook is a session-less server-to-server POST that must not be
  // redirected), static assets, and image optimization.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
