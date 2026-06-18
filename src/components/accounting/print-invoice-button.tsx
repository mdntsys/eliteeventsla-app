"use client";

/**
 * "Save as PDF" — triggers the browser print dialog. With the print styles on
 * the invoice page (app chrome and internal controls hidden), Cmd/Ctrl+P →
 * "Save as PDF" produces a clean, sendable invoice document. This bridges the
 * blocked Resend email path: operators can produce and send the PDF manually
 * until an email key is configured. Hidden in the printout itself.
 */
export function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-(--radius-card) border border-line bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-card print:hidden"
    >
      Save as PDF
    </button>
  );
}
