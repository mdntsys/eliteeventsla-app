import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { canEdit } from "@/lib/auth/roles";
import {
  getDocument,
  getSignedDocumentUrl,
  listDocumentAudit,
} from "@/lib/documents/queries";
import type { SowPayload } from "@/lib/documents/sow";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentActions } from "@/components/documents/document-actions";
import { SowDocumentView } from "@/components/documents/sow-view";

export const metadata: Metadata = { title: "Document" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  voided: "Voided",
};

const KIND_LABELS: Record<string, string> = {
  affiliate_contract: "Affiliate contract",
  customer_sow: "Customer SOW",
  other: "Other",
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireView("documents");
  const { id } = await params;

  const doc = await getDocument(id);
  if (!doc) notFound();

  const [audit, signedUrl] = await Promise.all([
    listDocumentAudit(id),
    getSignedDocumentUrl(doc.storage_path),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Partners / Documents"
        title={doc.title}
        description={STATUS_LABELS[doc.status] ?? doc.status}
        action={<DocumentActions documentId={doc.id} status={doc.status} />}
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Status">
              {STATUS_LABELS[doc.status] ?? doc.status}
            </Field>
            <Field label="Kind">{KIND_LABELS[doc.kind] ?? doc.kind}</Field>
            <Field label="Signer name">{doc.signer_name ?? "—"}</Field>
            <Field label="Signer email">{doc.signer_email ?? "—"}</Field>
            <Field label="Signed at">{formatDateTime(doc.signed_at)}</Field>
            {signedUrl && (
              <Field label="Document">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-navy underline-offset-2 hover:underline"
                >
                  Download signed PDF
                </a>
              </Field>
            )}
          </div>
        </section>

        {doc.kind === "customer_sow" && (
          <section className="rounded-(--radius-card) border border-line bg-card p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-light text-navy">
                  Document preview
                </h2>
                <p className="text-sm text-muted">
                  {doc.status === "draft"
                    ? "Review the full document, then send it for signature."
                    : "Exactly what the client sees on the signing link."}
                </p>
              </div>
              {doc.status === "draft" && canEdit(profile, "documents") && (
                <Link
                  href={`/documents/${doc.id}/edit`}
                  className="shrink-0 rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
                >
                  Edit draft
                </Link>
              )}
            </div>
            <SowDocumentView payload={doc.payload as SowPayload} />
          </section>
        )}

        {doc.status === "signed" && (
          <section className="rounded-(--radius-card) border border-line bg-card p-6">
            <h2 className="font-display text-lg font-light text-navy">
              Signature record
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Signature name">{doc.signature_name ?? "—"}</Field>
              <Field label="Signer IP">{doc.signer_ip ?? "—"}</Field>
              <Field label="Signer user agent">
                {doc.signer_user_agent ?? "—"}
              </Field>
              <Field label="Content fingerprint (SHA-256)">
                <span className="break-all font-mono text-xs text-muted">
                  {doc.content_hash ?? "—"}
                </span>
              </Field>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-light text-navy">
            Audit trail
          </h2>
          {audit.length === 0 ? (
            <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-8 text-center text-sm text-muted">
              No activity recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-3 font-medium text-muted">When</th>
                      <th className="px-4 py-3 font-medium text-muted">Event</th>
                      <th className="px-4 py-3 font-medium text-muted">Actor</th>
                      <th className="px-4 py-3 font-medium text-muted">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {audit.map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="px-4 py-3 text-ink">
                          {formatDateTime(a.at)}
                        </td>
                        <td className="px-4 py-3 text-ink">{a.event}</td>
                        <td className="px-4 py-3 text-muted">
                          {a.actor ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">{a.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
