import { requireView } from "@/lib/auth/dal";
import { list1099Report } from "@/lib/affiliates/queries";

/**
 * CSV export of the 1099 report for a calendar year. Gated on affiliates-view
 * (same as the report page). Returns a downloadable text/csv attachment.
 */

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request): Promise<Response> {
  await requireView("affiliates");

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year") ?? "";
  const currentYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(yearParam) ? Number(yearParam) : currentYear;

  const rows = await list1099Report(year);

  const header = [
    "Affiliate",
    "Email",
    `Paid ${year}`,
    "Payouts",
    "W-9 on file",
    "Status",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.name ?? ""),
        csvCell(r.email ?? ""),
        csvCell(r.paidTotal.toFixed(2)),
        csvCell(r.payoutCount),
        csvCell(r.w9OnFile ? "yes" : "no"),
        csvCell(r.status),
      ].join(","),
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="1099-report-${year}.csv"`,
    },
  });
}
