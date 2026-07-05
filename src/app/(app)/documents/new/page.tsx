import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import { getEventSowDefaults } from "@/lib/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { SowBuilder } from "@/components/documents/sow-builder";

export const metadata: Metadata = { title: "New SOW" };

export default async function NewSowPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  await requireView("documents");

  const { event } = await searchParams;
  const defaults = event ? await getEventSowDefaults(event) : null;

  return (
    <>
      <PageHeader
        eyebrow="Partners / Documents"
        title="New SOW"
        description="Build a statement of work to send a customer for signature."
      />

      <SowBuilder defaults={defaults} />
    </>
  );
}
