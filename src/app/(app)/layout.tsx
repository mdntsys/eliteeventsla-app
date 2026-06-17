import { requireProfile } from "@/lib/auth/dal";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  // Invited but not yet granted a role — no data access until an admin assigns one.
  if (!profile.role) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <p className="eyebrow">Pending access</p>
          <h1 className="font-display mt-2 text-3xl font-light text-navy">
            Your account is awaiting approval
          </h1>
          <p className="mt-3 text-sm text-muted">
            Signed in as {profile.email}. An administrator needs to assign your
            role before you can access the platform.
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

  return (
    <div className="flex min-h-svh">
      <AppSidebar
        role={profile.role}
        name={profile.full_name}
        email={profile.email}
      />
      <div className="flex-1 overflow-x-hidden">
        <main className="mx-auto max-w-6xl px-8 py-10">{children}</main>
      </div>
    </div>
  );
}
