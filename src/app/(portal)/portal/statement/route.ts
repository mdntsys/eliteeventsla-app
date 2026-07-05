import { NextResponse } from "next/server";
import { requireAffiliate } from "@/lib/portal/auth";
import {
  getAffiliateEarnings,
  listAffiliateCommissions,
  listAffiliatePayouts,
} from "@/lib/affiliates/queries";
import { renderAffiliateStatementPdf } from "@/lib/pdf/affiliate-statement-pdf";
import { COMPANY } from "@/lib/company";

// PDF generation needs the Node runtime; never cache a partner's statement.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in affiliate's own commission statement as a PDF. Everything is read
 * under their owner-scoped RLS, so it can only ever contain their own data.
 */
export async function GET(): Promise<Response> {
  const { affiliate } = await requireAffiliate();

  const [earnings, commissions, payouts] = await Promise.all([
    getAffiliateEarnings(affiliate.id),
    listAffiliateCommissions(affiliate.id),
    listAffiliatePayouts(affiliate.id),
  ]);

  const pdf = await renderAffiliateStatementPdf({
    companyName: COMPANY.name,
    affiliateName: affiliate.full_name,
    affiliateEmail: affiliate.email,
    commissionRate: affiliate.commission_rate,
    generatedAt: new Date().toISOString(),
    totals: {
      owed: earnings.owed,
      paid: earnings.paid,
      earned: earnings.earned,
    },
    commissions: commissions.map((c) => ({
      eventTitle: c.event_title,
      invoiceNumber: c.invoice_number,
      basis: c.basis_amount ?? 0,
      rate: c.rate ?? 0,
      amount: c.amount ?? 0,
      status: c.status,
      earnedAt: c.earned_at,
    })),
    payouts: payouts
      .filter((p) => !p.voided_at)
      .map((p) => ({
        paidAt: p.paid_at,
        amount: p.amount ?? 0,
        method: p.method,
        reference: p.reference,
      })),
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="commission-statement.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
