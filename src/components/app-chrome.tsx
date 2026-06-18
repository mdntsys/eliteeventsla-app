"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarContent } from "@/components/sidebar-content";
import type { AppRole } from "@/lib/auth/roles";

export function AppChrome({
  role,
  name,
  email,
  children,
}: {
  role: AppRole;
  name: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const closeDrawer = () => setOpen(false);

  // Close the drawer whenever the route changes.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Close the drawer on Escape.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="flex h-svh flex-col overflow-hidden lg:flex-row print:block print:h-auto print:overflow-visible">
      {/* Desktop: static left sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-card lg:flex print:lg:hidden">
        <SidebarContent role={role} name={name} email={email} />
      </aside>

      {/* Mobile: sticky top bar */}
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-3 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-(--radius-card) text-ink transition hover:bg-cream-deep"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <p className="font-display text-lg font-normal leading-none text-navy">
          Elite Events LA
        </p>
      </header>

      {/* Mobile: off-canvas drawer + overlay */}
      <div
        className={[
          "fixed inset-0 z-40 lg:hidden",
          open ? "" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!open}
      >
        {/* Dimmed overlay */}
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label="Close navigation menu"
          onClick={closeDrawer}
          className={[
            "absolute inset-0 bg-navy/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
        {/* Sliding panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={[
            "absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-card shadow-xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation menu"
            className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-(--radius-card) text-muted transition hover:bg-cream-deep hover:text-navy"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <SidebarContent
            role={role}
            name={name}
            email={email}
            onNavigate={closeDrawer}
          />
        </div>
      </div>

      {/* Content pane */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
