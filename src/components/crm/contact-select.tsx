"use client";

import { useState, useTransition } from "react";
import { createContactInline } from "@/lib/crm/actions";
import type { Option } from "@/lib/crm/types";

/**
 * Contact picker with inline "add a contact" — drop-in for a `<select
 * name="contact_id">`. Picking an existing contact works as a plain select;
 * "+ New contact" reveals a small panel that creates the contact via
 * `createContactInline` and selects it in place, so you never leave the deal
 * form to add someone and come back.
 *
 * The inline inputs are deliberately **name-less** and live outside any nested
 * <form> (which would be invalid HTML inside the parent deal form). They're
 * plain React state fed straight to the server action; only the controlled
 * `<select name={name}>` participates in the surrounding form submission.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const SUBFIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";

export function ContactSelect({
  name,
  contacts,
  companies,
  defaultValue,
}: {
  name: string;
  contacts: Option[];
  companies: Option[];
  defaultValue?: string;
}) {
  const [options, setOptions] = useState<Option[]>(contacts);
  const [value, setValue] = useState(defaultValue ?? "");
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // New-contact draft fields.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState("");

  function resetDraft() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompanyId("");
    setError(null);
  }

  function handleAdd() {
    setError(null);
    if (firstName.trim() === "") {
      setError("A first name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createContactInline({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company_id: companyId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOptions((prev) =>
        [...prev, res.contact].sort((a, b) => a.label.localeCompare(b.label)),
      );
      setValue(res.contact.id);
      setAdding(false);
      resetDraft();
    });
  }

  // Enter inside a draft field adds the contact instead of submitting the deal.
  function onDraftKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={FIELD}
      >
        <option value="">No contact</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      {!adding ? (
        <button
          type="button"
          onClick={() => {
            resetDraft();
            setAdding(true);
          }}
          className="self-start text-xs font-medium text-navy underline-offset-2 transition hover:underline"
        >
          + New contact
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-(--radius-card) border border-line bg-cream/50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="First name *"
              aria-label="First name"
              autoFocus
              className={SUBFIELD}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Last name"
              aria-label="Last name"
              className={SUBFIELD}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Email"
              aria-label="Email"
              className={SUBFIELD}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={onDraftKeyDown}
              placeholder="Phone"
              aria-label="Phone"
              className={SUBFIELD}
            />
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              aria-label="Company"
              className={`${SUBFIELD} sm:col-span-2`}
            >
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
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
              {pending ? "Adding…" : "Add contact"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                resetDraft();
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
