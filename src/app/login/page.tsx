import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="eyebrow">Operations OS</p>
          <h1 className="font-display mt-2 text-4xl font-light text-navy">
            Elite Events LA
          </h1>
          <p className="mt-3 text-sm text-muted">
            Internal access only. Sign in to continue.
          </p>
        </div>

        <div className="rounded-(--radius-card) border border-line bg-card p-7 shadow-sm">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Need an account? Ask an administrator to invite you.
        </p>
      </div>
    </main>
  );
}
