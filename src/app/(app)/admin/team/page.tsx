import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { listTeamMembers } from "@/lib/admin/queries";
import { PageHeader } from "@/components/ui/page-header";
import { InviteForm } from "@/components/admin/invite-form";
import { TeamMemberCard } from "@/components/admin/team-member-card";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireSuperAdmin();
  const members = await listTeamMembers();

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Team"
        description="Manage who has access, the role they hold, and their per-area View/Edit permissions. New users start with no role until granted one. Permissions default to the role preset — toggle to restrict an area below it."
        action={<InviteForm />}
      />

      <div className="grid gap-4">
        {members.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            isSelf={member.id === me.id}
          />
        ))}
        {members.length === 0 && (
          <p className="text-sm text-muted">No team members yet.</p>
        )}
      </div>
    </>
  );
}
