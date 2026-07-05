"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY } from "@/lib/company";

const NAV_LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/referrals", label: "Referrals" },
  { href: "/portal/payouts", label: "Payouts" },
  { href: "/portal/documents", label: "Documents" },
] as const;

export function PortalChrome({
  name,
  signed,
  children,
}: {
  name: string | null;
  signed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/portal" className="font-display text-lg text-navy">
            {COMPANY.name} Partner Portal
          </Link>
          <div className="flex items-center gap-4">
            {name && (
              <span className="hidden text-sm text-muted sm:inline">{name}</span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-(--radius-card) border border-line px-3 py-1.5 text-sm text-muted transition hover:border-navy hover:text-navy"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {signed && (
          <nav className="mx-auto w-full max-w-4xl px-4">
            <ul className="flex flex-wrap gap-1 pb-2">
              {NAV_LINKS.map((link) => {
                const active =
                  link.href === "/portal"
                    ? pathname === "/portal"
                    : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "block rounded-(--radius-card) px-3 py-1.5 text-sm transition",
                        active
                          ? "bg-navy text-cream"
                          : "text-ink hover:bg-cream-deep",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
