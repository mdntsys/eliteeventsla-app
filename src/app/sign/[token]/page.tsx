import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDocumentByToken } from "@/lib/documents/public";
import { markDocumentViewed } from "@/lib/documents/actions";
import {
  affiliateContractClauses,
  type ContractPayload,
} from "@/lib/documents/contract";
import type { SowPayload } from "@/lib/documents/sow";
import { formatDate } from "@/lib/accounting/format";
import { COMPANY } from "@/lib/company";
import { SignForm } from "@/components/documents/sign-form";
import { SowDocumentView } from "@/components/documents/sow-view";

// Always render fresh — a signer must never see a stale-cached signing state.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign document",
  robots: { index: false, follow: false },
};

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const doc = await getDocumentByToken(token);
  if (!doc) notFound();

  const signed = doc.status === "signed";
  const unavailable = doc.status === "voided" || doc.token_expired;

  // Fire-and-forget view stamp — only while still actionable.
  if (!signed && !unavailable) {
    await markDocumentViewed(token);
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10">
      <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
        {/* Header */}
        <div className="border-b border-line p-6 sm:p-8">
          <p className="font-display text-2xl font-light text-navy">
            {COMPANY.name}
          </p>
          <p className="mt-1 text-sm text-muted">{doc.title}</p>
        </div>

        <div className="p-6 sm:p-8">
          {signed ? (
            <div className="rounded-(--radius-card) border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
              ✓ This document has been signed
              {doc.signed_at ? ` on ${formatDate(doc.signed_at)}` : ""}. No
              further action is needed.
            </div>
          ) : unavailable ? (
            <div className="rounded-(--radius-card) border border-line bg-cream px-4 py-3 text-sm text-muted">
              This link is no longer available.
            </div>
          ) : (
            <>
              {doc.kind === "affiliate_contract" ? (
                <ContractView payload={doc.payload as ContractPayload} />
              ) : doc.kind === "customer_sow" ? (
                <SowDocumentView payload={doc.payload as SowPayload} />
              ) : (
                <OtherView payload={doc.payload} />
              )}
              <SignForm
                token={token}
                signerName={doc.signer_name}
                completeHref="/sign/thank-you"
                requireMediaRelease={doc.kind === "customer_sow"}
              />
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Questions? Contact {COMPANY.email}.
      </p>
    </main>
  );
}

function ContractView({ payload }: { payload: ContractPayload }) {
  const clauses = affiliateContractClauses(payload);
  return (
    <>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Effective date</dt>
          <dd className="mt-1 text-sm text-ink">
            {formatDate(payload.effectiveDate)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Representative</dt>
          <dd className="mt-1 text-sm text-ink">{payload.representativeName}</dd>
        </div>
        <div>
          <dt className="eyebrow">Commission</dt>
          <dd className="mt-1 text-sm text-ink">{payload.commissionPct}%</dd>
        </div>
      </dl>

      <div className="mt-6 max-h-[420px] space-y-4 overflow-y-auto rounded-(--radius-card) border border-line p-4">
        {clauses.map((clause) => (
          <div key={clause.heading}>
            <p className="font-medium text-navy">{clause.heading}</p>
            <p className="mt-1 text-sm text-ink">{clause.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function OtherView({ payload }: { payload: unknown }) {
  const facts =
    payload && typeof payload === "object"
      ? Object.entries(payload as Record<string, unknown>).filter(
          ([, v]) => v != null && typeof v !== "object",
        )
      : [];
  return (
    <>
      <p className="text-sm text-ink">Please review and sign.</p>
      {facts.length > 0 && (
        <dl className="mt-4 space-y-2 rounded-(--radius-card) border border-line p-4">
          {facts.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4 text-sm">
              <dt className="text-muted">{key}</dt>
              <dd className="text-ink">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
