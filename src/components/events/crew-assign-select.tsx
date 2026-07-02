"use client";

import { useState, useTransition } from "react";
import { createCrewInline } from "@/lib/events/actions";
import type { StaffMember } from "@/lib/events/types";

/**
 * Assignee picker for a schedule stop: choose a login STAFF member or a
 * lightweight CREW member (name + phone, no login), with an inline "+ New crew"
 * that creates one via createCrewInline and selects it in place — mirroring the
 * contact picker on deals. Emits two hidden fields (profile_id / crew_member_id)
 * so the surrounding assign form posts exactly one to assignStaff.
 *
 * The inline inputs are deliberately name-less (React state only) so they never
 * submit with the parent form; Enter inside them adds the crew member instead.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";
const SUBFIELD =
  "rounded-(--radius-card) border border-line bg-cream px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-navy";

type CrewOption = { id: string; label: string };

export function CrewAssignSelect({
  staff,
  crew,
}: {
  staff: StaffMember[];
  crew: CrewOption[];
}) {
  const [crewOptions, setCrewOptions] = useState<CrewOption[]>(crew);
  const [value, setValue] = useState(""); // "staff:<id>" | "crew:<id>" | ""
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const profileId = value.startsWith("staff:") ? value.slice(6) : "";
  const crewId = value.startsWith("crew:") ? value.slice(5) : "";

  function handleAdd() {
    setError(null);
    if (name.trim() === "") {
      setError("A name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createCrewInline({ name, phone });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCrewOptions((prev) =>
        [...prev, res.crew].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setValue(`crew:${res.crew.id}`);
      setAdding(false);
      setName("");
      setPhone("");
    });
  }

  function onDraftKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="crew_member_id" value={crewId} />

      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Assign to"
        className={FIELD}
      >
        <option value="" disabled>
          Select staff or crew…
        </option>
        {staff.length > 0 && (
          <optgroup label="Staff">
            {staff.map((s) => (
              <option key={s.id} value={`staff:${s.id}`}>
                {s.full_name ?? "Unnamed"}
                {s.role ? ` (${s.role})` : ""}
              </option>
            ))}
          </optgroup>
        )}
        {crewOptions.length > 0 && (
          <optgroup label="Crew">
            {crewOptions.map((c) => (
              <option key={c.id} value={`crew:${c.id}`}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {!adding ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAdding(true);
          }}
          className="self-start text-xs font-medium text-navy underline-offset-2 transition hover:underline"
        >
          + New crew
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-(--radius-card) border border-line bg-cream/50 p-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Name *"
              aria-label="Crew name"
              autoFocus
              className={SUBFIELD}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Phone"
              aria-label="Crew phone"
              className={SUBFIELD}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAdd}
              disabled={pending}
              className="rounded-(--radius-card) bg-navy px-3 py-1.5 text-xs font-medium text-cream transition hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add crew"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setName("");
                setPhone("");
                setError(null);
              }}
              disabled={pending}
              className="text-xs text-muted transition hover:text-ink disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
