import Link from "next/link";
import { requirePortalAccess } from "@/lib/portal/auth";
import { getMyDocuments, getSignedDocumentUrl } from "@/lib/documents/queries";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/accounting/format";

// Signing state must never be stale-cached for the affiliate viewing it.
export const dynamic = "force-dynamic";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function PortalDocumentsPage() {
  await requirePortalAccess();
  const docs = await getMyDocuments();
  const withUrls = await Promise.all(
    docs.map(async (doc) => ({
      doc,
      url: await getSignedDocumentUrl(doc.storage_path),
    })),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Partner portal"
        title="Documents"
        description="Agreements and paperwork shared with you."
      />

      {withUrls.length === 0 ? (
        <div className="rounded-(--radius-card) border border-line bg-cream px-4 py-8 text-center text-sm text-muted">
          No documents yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-(--radius-card) border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 eyebrow font-normal">Title</th>
                <th className="px-4 py-3 eyebrow font-normal">Status</th>
                <th className="px-4 py-3 eyebrow font-normal">Signed</th>
                <th className="px-4 py-3 eyebrow font-normal text-right">
                  Document
                </th>
              </tr>
            </thead>
            <tbody>
              {withUrls.map(({ doc, url }) => (
                <tr
                  key={doc.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-3 text-ink">{doc.title}</td>
                  <td className="px-4 py-3 text-muted">
                    {capitalize(doc.status)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {doc.signed_at ? formatDate(doc.signed_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {url ? (
                      <Link
                        href={url}
                        target="_blank"
                        className="font-medium text-navy hover:opacity-80"
                      >
                        Download PDF
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
