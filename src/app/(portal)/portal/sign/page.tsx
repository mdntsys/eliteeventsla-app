import { redirect } from "next/navigation";
import { requireAffiliate } from "@/lib/portal/auth";
import { prepareMyContractForSigning } from "@/lib/documents/actions";
import {
  affiliateContractClauses,
  type ContractPayload,
} from "@/lib/documents/contract";
import { SignForm } from "@/components/documents/sign-form";
import { COMPANY } from "@/lib/company";

// A signer must never see a stale-cached signing state.
export const dynamic = "force-dynamic";

export default async function PortalSignPage() {
  await requireAffiliate();
  const prep = await prepareMyContractForSigning();

  if (!prep) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-4 py-10">
        <div className="rounded-(--radius-card) border border-line bg-card p-6 text-sm text-muted sm:p-8">
          We couldn&apos;t load your agreement — please contact {COMPANY.email}.
        </div>
      </main>
    );
  }

  if (prep.signed) redirect("/portal");

  const payload = prep.payload as ContractPayload;
  const clauses = affiliateContractClauses(payload);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10">
      <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
        <div className="border-b border-line p-6 sm:p-8">
          <p className="font-display text-2xl font-light text-navy">
            Sign your commission agreement
          </p>
          <p className="mt-2 text-sm text-muted">
            Please review and sign your Sales Commission Agreement to access
            your partner portal.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="max-h-[420px] space-y-4 overflow-y-auto rounded-(--radius-card) border border-line p-4">
            {clauses.map((clause) => (
              <div key={clause.heading}>
                <p className="font-medium text-navy">{clause.heading}</p>
                <p className="mt-1 text-sm text-ink">{clause.body}</p>
              </div>
            ))}
          </div>

          <SignForm
            token={prep.token as string}
            signerName={payload.representativeName}
            continueHref="/portal"
          />
        </div>
      </div>
    </main>
  );
}
