import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Post-signing confirmation. The public signing flow redirects here after a
 * successful sign (the single-use token is consumed, so the signing page itself
 * would 404). No login, no token — a plain thank-you.
 */
export default function SignThankYouPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-16">
      <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card p-8 text-center sm:p-10">
        <p className="font-display text-2xl font-light text-navy">
          {COMPANY.name}
        </p>
        <div
          aria-hidden
          className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-700 ring-1 ring-green-200"
        >
          ✓
        </div>
        <h1 className="mt-5 font-display text-2xl font-light text-navy">
          Thank you — you&rsquo;re all set
        </h1>
        <p className="mt-3 text-sm text-ink">
          Your document has been signed and recorded. You can safely close this
          tab.
        </p>
        <p className="mt-2 text-sm text-muted">
          A copy of the signed agreement is on its way to your email for your
          records.
        </p>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Questions? Contact {COMPANY.email}.
      </p>
    </main>
  );
}
