"use client";

/**
 * Generic "Save as PDF" / print trigger. The app chrome and any element marked
 * `print:hidden` drop out under the global print styles, so Cmd/Ctrl+P → Save
 * as PDF yields a clean document. Hidden in the printout itself.
 */
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-(--radius-card) border border-line bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-card print:hidden"
    >
      {label}
    </button>
  );
}
