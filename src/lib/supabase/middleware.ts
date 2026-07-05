import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request and performs an
 * optimistic auth redirect. Invoked from `proxy.ts` (the Next.js 16 rename of
 * middleware). This is only the first gate — real authorization happens in the
 * Data Access Layer (src/lib/auth/dal.ts) and Postgres RLS.
 *
 * Do not insert logic between `createServerClient` and `auth.getUser()`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  // Public surfaces that must work without a session: login, auth callbacks, the
  // token-gated client invoice pages (/i/<token>), and the token-gated document
  // signing pages (/sign/<token>). The API routes (/api/...) are already outside
  // the proxy matcher.
  const isPublic =
    isLogin ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/sign/");

  // Not signed in → push to /login (remember where they were headed).
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return redirectPreservingSession(url, supabaseResponse);
  }

  // Already signed in but sitting on /login → send to the dashboard.
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectPreservingSession(url, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * Redirect while carrying over any auth cookies the Supabase client refreshed
 * onto `sessionResponse`. Without this, a redirect issued on the same request
 * that rotated the session would drop the new tokens and silently log the user
 * out on the next request.
 */
function redirectPreservingSession(url: URL, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}
