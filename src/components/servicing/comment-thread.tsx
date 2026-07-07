import type { TicketCommentRow } from "@/lib/servicing/types";

/**
 * The ticket comment thread, oldest-first. Server component. Each note shows
 * its author and a short timestamp above the body.
 */

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function CommentThread({ comments }: { comments: TicketCommentRow[] }) {
  if (comments.length === 0) {
    return (
      <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
        No notes yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((c) => (
        <li
          key={c.id}
          className="rounded-(--radius-card) border border-line bg-cream px-4 py-3"
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">
              {c.author_name ?? "Unknown"}
            </span>
            <span className="text-xs text-muted">{formatTime(c.created_at)}</span>
          </div>
          <p className="whitespace-pre-line text-sm text-ink">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
