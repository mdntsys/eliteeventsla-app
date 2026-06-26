"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Centered modal dialog rendered through a portal on document.body, so it always
 * overlays the full viewport regardless of where its trigger lives (e.g. inside
 * a PageHeader's right-aligned action slot, which otherwise crams the form into
 * a narrow column). Closes on Escape, on a backdrop click, and via the ×; locks
 * body scroll while open. Used by every "New …" / "Edit" toggle form so they all
 * present consistently across the app.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Only close on a backdrop click when the press *started* on the backdrop —
  // otherwise a text selection that drag-releases outside an input would close it.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // The Modal only renders behind `{open && …}` (open starts false), so it never
  // renders during SSR; this guard is belt-and-suspenders for the portal target.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div className="my-auto w-full max-w-2xl rounded-(--radius-card) border border-line bg-card p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          {title ? <p className="eyebrow">{title}</p> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 shrink-0 rounded-(--radius-card) px-2 text-2xl leading-none text-muted transition hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
