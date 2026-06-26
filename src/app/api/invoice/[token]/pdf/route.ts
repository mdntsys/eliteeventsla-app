import { NextResponse } from "next/server";
import { getInvoiceByToken } from "@/lib/invoices/public";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

// PDF generation needs the Node runtime; never cache an invoice document.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, token-gated invoice PDF. The token is the bearer credential; an
 * unknown token 404s. Lives under /api/* so it's outside the proxy auth gate.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invoice = await getInvoiceByToken(token);
  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });

  const pdf = await renderInvoicePdf(invoice);
  const name = `Invoice-${invoice.invoice_number ?? invoice.id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
