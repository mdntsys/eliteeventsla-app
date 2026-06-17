"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { setInventoryImage } from "@/lib/inventory/actions";
import type { ActionState } from "@/lib/inventory/types";

/**
 * Reusable photo uploader for inventory items and units. Supports a file
 * picker, clipboard paste, and drag-and-drop. The image is uploaded directly
 * from the browser to the public 'inventory-photos' Storage bucket (RLS lets
 * the signed-in ops/admin user write), then the resulting public URL is
 * persisted via the setInventoryImage server action.
 */

const BUCKET = "inventory-photos";

type Props = {
  kind: "item" | "unit";
  targetId: string;
  itemId: string;
  currentUrl: string | null;
  label?: string;
};

/** Make a filesystem/URL-safe filename fragment from an arbitrary name. */
function safeFileName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "image";
}

export function ImageUpload({
  kind,
  targetId,
  itemId,
  currentUrl,
  label,
}: Props) {
  // The URL we want to persist once upload succeeds. Submitted via the form.
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  // Track the last server-provided URL so we can resync the preview during
  // render (instead of in an effect) when it changes from the parent.
  const [lastCurrentUrl, setLastCurrentUrl] = useState<string | null>(
    currentUrl,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, saving] = useActionState<ActionState, FormData>(
    setInventoryImage,
    undefined,
  );

  // Keep the preview in sync if the server-provided current URL changes. This
  // adjusts state during render (the recommended pattern over a setState
  // effect) so the preview tracks the latest persisted photo.
  if (currentUrl !== lastCurrentUrl) {
    setLastCurrentUrl(currentUrl);
    setPreview(currentUrl);
  }

  // Once we have a freshly uploaded public URL, submit the form to persist it.
  useEffect(() => {
    if (pendingUrl && urlInputRef.current) {
      urlInputRef.current.value = pendingUrl;
      formRef.current?.requestSubmit();
    }
  }, [pendingUrl]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    setUploadError(null);
    setUploading(true);

    // Optimistic local preview while the upload runs.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const supabase = createClient();
      const path = `${kind}s/${targetId}/${crypto.randomUUID()}-${safeFileName(
        file.name,
      )}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      if (error) {
        setUploadError(error.message);
        setPreview(currentUrl);
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setPreview(data.publicUrl);
      setPendingUrl(data.publicUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
      setPreview(currentUrl);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFile(file);
          return;
        }
      }
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  const busy = uploading || saving;
  const error = uploadError ?? state?.error ?? null;
  const saved = state?.success === true && !busy && !uploadError;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="eyebrow text-muted">{label}</span>
      )}

      <div
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-(--radius-card) border border-dashed bg-cream p-4 text-center transition focus:outline-none focus-visible:border-navy ${
          dragOver ? "border-navy" : "border-line"
        }`}
      >
        {preview ? (
          <span className="relative block h-32 w-full max-w-xs overflow-hidden rounded-(--radius-card) border border-line bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label ?? "Inventory photo"}
              className="h-full w-full object-contain"
            />
          </span>
        ) : (
          <span className="flex h-32 w-full max-w-xs items-center justify-center rounded-(--radius-card) border border-line bg-card text-sm text-muted">
            No photo yet
          </span>
        )}

        <p className="text-xs text-muted">
          Tap to choose a photo, paste from clipboard, or drag &amp; drop.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Allow re-selecting the same file.
            e.target.value = "";
          }}
        />
      </div>

      <div className="min-h-4 text-xs" aria-live="polite">
        {busy && <span className="text-muted">Uploading…</span>}
        {saved && <span className="text-green-700">Saved.</span>}
        {error && (
          <span role="alert" className="text-red-700">
            {error}
          </span>
        )}
      </div>

      {/* Hidden form that persists the public URL via the server action. */}
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="target_id" value={targetId} />
        <input type="hidden" name="item_id" value={itemId} />
        <input ref={urlInputRef} type="hidden" name="url" defaultValue="" />
      </form>
    </div>
  );
}

export default ImageUpload;
