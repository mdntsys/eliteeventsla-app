import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getSowForEdit } from "@/lib/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { SowBuilder } from "@/components/documents/sow-builder";

export const metadata: Metadata = { title: "Edit SOW" };

export default async function EditSowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("documents");
  const { id } = await params;

  // Only draft customer SOWs are editable; anything else routes back to detail.
  const initial = await getSowForEdit(id);
  if (!initial) redirect(`/documents/${id}`);

  return (
    <>
      <PageHeader
        eyebrow="Partners / Documents"
        title="Edit SOW"
        description="Update this draft, then preview and send it for signature."
        action={
          <Link
            href={`/documents/${id}`}
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Back to document
          </Link>
        }
      />

      <SowBuilder initial={initial} />
    </>
  );
}
