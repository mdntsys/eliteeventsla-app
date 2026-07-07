import { NextResponse } from "next/server";
import { requireView } from "@/lib/auth/dal";
import { getEventPickList } from "@/lib/events/queries";
import { renderPickListPdf } from "@/lib/pdf/pick-list-pdf";
import { COMPANY } from "@/lib/company";

// PDF generation needs the Node runtime; always reflect the latest reservations.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A warehouse pick list for one event, as a printable PDF. Gated on view access
 * to events; the pick list is read under the caller's RLS session.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await requireView("events");
  const { id } = await params;

  const pickList = await getEventPickList(id);
  if (!pickList) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdf = await renderPickListPdf({
    companyName: COMPANY.name,
    generatedAt: new Date().toISOString(),
    pickList,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pick-list.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
