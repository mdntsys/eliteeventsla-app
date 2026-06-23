import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const profile = await requireProfile();
  const roleLabel = profile.is_super_admin
    ? "Super Admin"
    : profile.role
      ? ROLE_LABELS[profile.role]
      : "Pending access";

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={profile.full_name || "Your account"}
        description="Your profile and sign-in password."
      />

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <h2 className="eyebrow mb-3">Profile</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Name</dt>
              <dd className="text-ink">{profile.full_name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="text-ink">{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Access</dt>
              <dd className="text-ink">{roleLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <h2 className="eyebrow mb-3">Change password</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
