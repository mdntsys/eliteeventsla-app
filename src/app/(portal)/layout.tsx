import { requireAffiliate, isContractSigned } from "@/lib/portal/auth";
import { PortalChrome } from "@/components/portal/portal-chrome";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { affiliate } = await requireAffiliate();
  const signed = await isContractSigned(affiliate.id);

  return (
    <PortalChrome name={affiliate.full_name} signed={signed}>
      {children}
    </PortalChrome>
  );
}
