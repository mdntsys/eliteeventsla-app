"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/components/nav-config";
import { canAccess, ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export function SidebarContent({
  role,
  name,
  email,
  onNavigate,
}: {
  role: AppRole;
  name: string | null;
  email: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = NAV_SECTIONS.filter((section) =>
    canAccess(role, section.module),
  );

  return (
    <>
      <div className="border-b border-line px-5 py-5">
        <p className="eyebrow">Operations OS</p>
        <p className="font-display mt-1 text-xl font-normal leading-tight text-navy">
          Elite Events LA
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="eyebrow px-2 pb-1.5">{section.label}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onNavigate?.()}
                      className={[
                        "block rounded-(--radius-card) px-2.5 py-1.5 text-sm transition",
                        active
                          ? "bg-navy text-cream"
                          : "text-ink hover:bg-cream-deep",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-4 py-4">
        <p className="truncate text-sm font-medium text-ink">
          {name || email || "Team member"}
        </p>
        <p className="text-xs text-muted">{ROLE_LABELS[role]}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="w-full rounded-(--radius-card) border border-line px-3 py-1.5 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
