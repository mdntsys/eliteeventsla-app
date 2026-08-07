import type { Metadata } from "next";
import { requireEdit } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";

export const metadata: Metadata = { title: "Upload document" };

export default async function UploadDocumentPage() {
  // Creating a document is an edit action — gate the page to editors.
  await requireEdit("documents");

  return (
    <>
      <PageHeader
        eyebrow="Partners / Documents"
        title="Upload a document to sign"
        description="Send a finished PDF (a contract, an exhibit, an agreement) to someone for their signature."
      />

      <UploadDocumentForm />
    </>
  );
}
