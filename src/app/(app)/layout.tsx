import { requireUser, getProfile } from "@/lib/auth/dal";
import { AppChrome } from "@/components/app-chrome";

/** Centered interstitial for accounts that can't enter the app yet. */
function AccountNotice({
  eyebrow,
  title,
  body,
  email,
}: {
  eyebrow: string;
  title: string;
  body: string;
  email?: string | null;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-light text-navy">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {body}
          {email ? ` Signed in as ${email}.` : ""}
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // proxy already redirects unauthenticated requests; this is defense in depth.
  await requireUser();
  const profile = await getProfile();

  // Authenticated but no profile row (e.g. created before the signup trigger).
  // Don't redirect to /login — the proxy would bounce an authed user back here
  // and loop. Render a notice instead.
  if (!profile) {
    return (
      <AccountNotice
        eyebrow="Account"
        title="Account setup incomplete"
        body="We couldn't find your profile. Please contact an administrator."
      />
    );
  }

  // Deactivated: RLS already denies data access; show why and let them sign out.
  if (!profile.is_active) {
    return (
      <AccountNotice
        eyebrow="Account disabled"
        title="Your access has been turned off"
        body="An administrator has deactivated this account. Contact them to restore access."
        email={profile.email}
      />
    );
  }

  // Invited but not yet granted a role.
  if (!profile.role) {
    return (
      <AccountNotice
        eyebrow="Pending access"
        title="Your account is awaiting approval"
        body="An administrator needs to assign your role before you can access the platform."
        email={profile.email}
      />
    );
  }

  return (
    <AppChrome
      role={profile.role}
      name={profile.full_name}
      email={profile.email}
    >
      {children}
    </AppChrome>
  );
}
