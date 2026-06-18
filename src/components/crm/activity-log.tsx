"use client";

import { useActionState, useState } from "react";
import { logActivity, completeActivity } from "@/lib/crm/actions";
import type { ActionState, ActivityView, Option } from "@/lib/crm/types";

/**
 * The CRM activity log: a timeline of activities (calls, emails, meetings,
 * notes, tasks) plus an inline "log activity" form and a per-item "complete"
 * control for open tasks/follow-ups. Bound to logActivity / completeActivity
 * via useActionState, mirroring the servicing comment-thread + add-comment
 * pattern. The parent context (one of contact/company/deal/event id) is passed
 * through hidden inputs so the actions can attach + revalidate correctly.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

export type ActivityParent =
  | { kind: "contact"; id: string }
  | { kind: "company"; id: string }
  | { kind: "deal"; id: string }
  | { kind: "event"; id: string };

const TYPES = ["note", "call", "email", "meeting", "task"] as const;

const TYPE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  task: "Task",
};

function formatTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fieldName(parent: ActivityParent): string {
  switch (parent.kind) {
    case "contact":
      return "contact_id";
    case "company":
      return "company_id";
    case "deal":
      return "deal_id";
    case "event":
      return "event_id";
  }
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs font-medium text-muted">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function CompleteButton({
  activityId,
  parentId,
}: {
  activityId: string;
  parentId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    completeActivity,
    undefined,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={activityId} />
      <input type="hidden" name="parentId" value={parentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-navy hover:text-navy disabled:opacity-60"
      >
        {pending ? "Marking…" : "Mark done"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ActivityItem({
  activity,
  parentId,
}: {
  activity: ActivityView;
  parentId: string;
}) {
  const isOpenTask = activity.due_at != null && activity.completed_at == null;
  const completed = activity.completed_at != null;

  return (
    <li className="rounded-(--radius-card) border border-line bg-cream px-4 py-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={activity.type} />
          {activity.subject && (
            <span className="text-sm font-medium text-ink">
              {activity.subject}
            </span>
          )}
        </div>
        <span className="text-xs text-muted">
          {formatTime(activity.created_at)}
        </span>
      </div>

      {activity.body && (
        <p className="whitespace-pre-line text-sm text-ink">{activity.body}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {activity.assignee_name && <span>{activity.assignee_name}</span>}
          {activity.due_at && (
            <span className={completed ? "" : "text-amber-700"}>
              Due {formatTime(activity.due_at)}
            </span>
          )}
          {completed && (
            <span className="text-green-700">
              Done {formatTime(activity.completed_at)}
            </span>
          )}
        </div>
        {isOpenTask && (
          <CompleteButton activityId={activity.id} parentId={parentId} />
        )}
      </div>
    </li>
  );
}

function LogActivityForm({
  parent,
  staff,
}: {
  parent: ActivityParent;
  staff: Option[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    logActivity,
    undefined,
  );
  const [open, setOpen] = useState(false);

  // Close the form after a successful log (render-time, mirroring the vendor
  // edit form). The fields are uncontrolled and reset on the next open because
  // the collapsed state unmounts the <form>.
  if (state?.success && open) {
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-(--radius-card) bg-navy px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
      >
        Log activity
      </button>
    );
  }

  return (
    <form
      action={action}
      className="grid gap-3 rounded-(--radius-card) border border-line bg-card p-4 sm:grid-cols-2"
    >
      <input type="hidden" name={fieldName(parent)} value={parent.id} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Type</span>
        <select name="type" defaultValue="note" className={FIELD}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Subject</span>
        <input
          name="subject"
          type="text"
          placeholder="Optional"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-xs text-muted">Details</span>
        <textarea
          name="body"
          rows={3}
          placeholder="What happened?"
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Due / follow-up</span>
        <input name="due_at" type="datetime-local" className={FIELD} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Assigned to</span>
        <select name="assigned_to" defaultValue="" className={FIELD}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-(--radius-card) bg-navy px-4 py-2.5 text-sm font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log activity"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-sm text-muted transition hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ActivityLog({
  parent,
  activities,
  staff,
}: {
  parent: ActivityParent;
  activities: ActivityView[];
  staff: Option[];
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">Activity</h2>
        <span className="eyebrow">
          {activities.length} {activities.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="mb-6">
        {activities.length === 0 ? (
          <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
            No activity logged yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activities.map((a) => (
              <ActivityItem key={a.id} activity={a} parentId={parent.id} />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <LogActivityForm parent={parent} staff={staff} />
      </div>
    </section>
  );
}
