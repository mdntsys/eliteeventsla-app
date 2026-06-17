import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { NAV_SECTIONS } from "@/components/nav-config";
import { canAccess, ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const role = profile.role!; // (app)/layout guarantees a non-null role here.
  const firstName = profile.full_name?.split(" ")[0];

  const sections = NAV_SECTIONS.filter(
    (section) => section.module !== "dashboard" && canAccess(role, section.module),
  );

  return (
    <>
      <PageHeader
        eyebrow={`Signed in · ${ROLE_LABELS[role]}`}
        title={firstName ? `Welcome, ${firstName}` : "Welcome"}
        description="Your workspace for the full client lifecycle — from first inquiry to delivery and return."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.module}
            href={section.items[0].href}
            className="group rounded-(--radius-card) border border-line bg-card p-5 transition hover:border-navy"
          >
            <p className="font-display text-xl font-normal text-navy">
              {section.label}
            </p>
            <p className="mt-2 text-sm text-muted">
              {section.items.map((item) => item.label).join(" · ")}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
