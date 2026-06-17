"use client";

import { useActionState, useRef, useState } from "react";
import {
  importInventoryCsv,
  type ImportInventoryResult,
} from "@/lib/inventory/actions";

/**
 * "Import CSV" toggle + panel. Reads the chosen file client-side, stuffs the
 * text into a hidden input, and submits to importInventoryCsv via
 * useActionState. Shows the created/skipped counts and any per-row errors.
 */

const CSV_HEADER =
  "name,sku,kind,category,quantity,daily_rate,replacement_cost,location,row,section,description";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(
  `${CSV_HEADER}\n`,
)}`;

export function CsvImport() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<
    ImportInventoryResult,
    FormData
  >(
    importInventoryCsv,
    undefined,
  );

  async function handleSubmit(formData: FormData) {
    const file = fileRef.current?.files?.[0];
    if (file && csvRef.current) {
      csvRef.current.value = await file.text();
      formData.set("csv", csvRef.current.value);
    }
    return action(formData);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) border border-line bg-cream px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-card"
      >
        Import CSV
      </button>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Import</p>
          <h2 className="font-display mt-0.5 text-xl font-light text-navy">
            Import inventory from CSV
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-(--radius-card) border border-line bg-cream px-3.5 py-2 text-sm text-muted transition hover:text-ink"
        >
          Cancel
        </button>
      </div>

      <p className="mb-4 text-sm text-muted">
        Columns: <code className="text-ink">{CSV_HEADER}</code>.{" "}
        <a
          href={TEMPLATE_HREF}
          download="inventory-template.csv"
          className="text-navy underline-offset-2 hover:underline"
        >
          Download template
        </a>
      </p>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="csv" ref={csvRef} />
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-(--radius-card) file:border file:border-line file:bg-cream file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-card"
        />

        {state?.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}

        {state?.success && (
          <div className="rounded-(--radius-card) border border-line bg-cream p-4 text-sm">
            <p className="font-medium text-navy">
              Created {state.created ?? 0}, skipped {state.skipped ?? 0}
            </p>
            {state.errors && state.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700">
                {state.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !fileName}
            className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Importing…" : "Import"}
          </button>
          {fileName && (
            <span className="text-sm text-muted">{fileName}</span>
          )}
        </div>
      </form>
    </div>
  );
}
