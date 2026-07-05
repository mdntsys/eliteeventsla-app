import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import { listDocuments } from "@/lib/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsList } from "@/components/documents/documents-list";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  await requireView("documents");

  const docs = await listDocuments();

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Documents"
        description="Every contract and SOW — draft, sent, viewed, and signed."
      />

      <DocumentsList documents={docs} />
    </>
  );
}
