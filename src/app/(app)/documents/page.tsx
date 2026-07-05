import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import { listDocuments } from "@/lib/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsList } from "@/components/documents/documents-list";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const profile = await requireView("documents");

  const docs = await listDocuments();

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Documents"
        description="Every contract and SOW — draft, sent, viewed, and signed."
        action={
          canEdit(profile, "documents") ? (
            <Link
              href="/documents/new"
              className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
            >
              New SOW
            </Link>
          ) : undefined
        }
      />

      <DocumentsList documents={docs} />
    </>
  );
}
