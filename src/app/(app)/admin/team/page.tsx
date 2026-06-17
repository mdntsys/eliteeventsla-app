import type { Metadata } from "next";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  await requireModule("admin");
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Team"
        description="Manage who has access and what role they hold (sales, ops, accounting, admin). New users start with no role until granted one here."
      />
      <ModulePlaceholder
        items={[
          "Invite users (email)",
          "Assign & change roles",
          "Activate / deactivate accounts",
          "Pending-approval queue",
          "Per-user activity overview",
          "Audit of role changes",
        ]}
      />
    </>
  );
}
