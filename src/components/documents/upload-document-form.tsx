"use client";

import { useActionState, useState } from "react";
import { createUploadedDocument } from "@/lib/documents/actions";
import type { ActionState } from "@/lib/documents/types";

/**
 * Upload a finished PDF and send it to someone to sign. Two placement modes:
 *  • "Append a signature page" (default) — works for any PDF, no coordinates.
 *  • "Place on a page" — stamp the signature into the document's own block, e.g.
 *    beside a counterparty who already signed. The live preview helps you read
 *    the position off the page (across %, then down % from the top-left).
 * On success the action redirects to the new document, so this only shows errors.
 */
export function UploadDocumentForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createUploadedDocument,
    undefined,
  );
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [placement, setPlacement] = useState<"append" | "place">("append");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (!file) {
      setFileUrl(null);
      return;
    }
    setFileUrl(URL.createObjectURL(file));
    if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ""));
  }

  const inputClass =
    "mt-1 w-full rounded-(--radius-card) border border-line bg-card px-3 py-2 text-sm text-ink transition placeholder:text-muted focus:border-navy focus:outline-none";

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-navy">
              PDF to send <span className="text-red-600">*</span>
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={onFile}
              className="mt-1 w-full text-sm text-ink file:mr-3 file:rounded-(--radius-card) file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:opacity-90"
            />
            <p className="mt-1 text-xs text-muted">
              Any PDF, up to 20 MB. If your side already signed it, upload that
              copy.
            </p>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-navy">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Strategic Partnership Agreement — Love This Way"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="signer_name"
                className="block text-sm font-medium text-navy"
              >
                Signer name
              </label>
              <input
                id="signer_name"
                name="signer_name"
                type="text"
                placeholder="Paola Franco"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="signer_email"
                className="block text-sm font-medium text-navy"
              >
                Signer email
              </label>
              <input
                id="signer_email"
                name="signer_email"
                type="email"
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">
            You send it for signature from the next screen — nothing is emailed
            yet.
          </p>

          <fieldset className="border-t border-line pt-4">
            <legend className="text-sm font-medium text-navy">
              Where does the signature go?
            </legend>
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="placement"
                  value="append"
                  checked={placement === "append"}
                  onChange={() => setPlacement("append")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
                />
                <span>
                  <strong>Append a signature page</strong> — a clean signature +
                  certificate page is added at the end. Works for any PDF.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="placement"
                  value="place"
                  checked={placement === "place"}
                  onChange={() => setPlacement("place")}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
                />
                <span>
                  <strong>Place it on a page</strong> — stamp the signature into
                  the document&apos;s own signature block (e.g. next to someone
                  who already signed).
                </span>
              </label>
            </div>

            {placement === "place" && (
              <div className="mt-4 rounded-(--radius-card) border border-line bg-cream/50 p-4">
                <p className="text-xs text-muted">
                  Read the position off the preview: page number, then how far{" "}
                  <strong>across</strong> and <strong>down</strong> the page (in
                  %, from the top-left corner).
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Num label="Page #" name="sig_page" placeholder="6" />
                  <Num label="Across %" name="name_x" placeholder="30" />
                  <Num label="Down %" name="name_y" placeholder="34" />
                  <Num label="Size (pt)" name="name_size" placeholder="15" />
                </div>
                <p className="mt-4 text-xs font-medium text-navy">
                  Date stamp (optional)
                </p>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <Num label="Across %" name="date_x" placeholder="14" />
                  <Num label="Down %" name="date_y" placeholder="42" />
                  <Num label="Size (pt)" name="date_size" placeholder="11" />
                </div>
              </div>
            )}
          </fieldset>
        </div>

        <div>
          <p className="text-sm font-medium text-navy">Preview</p>
          {fileUrl ? (
            <iframe
              src={fileUrl}
              title="PDF preview"
              className="mt-1 h-[640px] w-full rounded-(--radius-card) border border-line bg-white"
            />
          ) : (
            <div className="mt-1 flex h-[640px] w-full items-center justify-center rounded-(--radius-card) border border-dashed border-line bg-cream text-sm text-muted">
              Choose a PDF to preview it here.
            </div>
          )}
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-5 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Create document"}
        </button>
      </div>
    </form>
  );
}

function Num({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        name={name}
        type="number"
        step="any"
        placeholder={placeholder}
        className="mt-1 w-full rounded-(--radius-card) border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-navy focus:outline-none"
      />
    </label>
  );
}
