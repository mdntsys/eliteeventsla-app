import type { Metadata } from "next";
import { requireView } from "@/lib/auth/dal";
import { listAffiliates } from "@/lib/affiliates/queries";
import { PageHeader } from "@/components/ui/page-header";
import { AffiliateForm } from "@/components/affiliates/affiliate-form";
import { AffiliatesList } from "@/components/affiliates/affiliates-list";

export const metadata: Metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  await requireView("affiliates");

  const affiliates = await listAffiliates();

  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Affiliates"
        description="Referral partners and their commission rates. Creating an affiliate provisions their portal login and emails a welcome."
        action={<AffiliateForm />}
      />

      <AffiliatesList affiliates={affiliates} />
    </>
  );
}
