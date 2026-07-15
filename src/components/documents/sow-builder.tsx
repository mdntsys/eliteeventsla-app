"use client";

import { useActionState, useState } from "react";
import { createSow, updateSow } from "@/lib/documents/actions";
import { formatMoney } from "@/lib/accounting/format";
import {
  CAMERA_TYPES,
  DEFAULT_PACKAGE_NAME,
  DEFAULT_SERVICE_HOURS,
  STANDARD_SETUP_NOTE,
  standardBoothInclusions,
  type SowInclusion,
  type SowPaymentStructure,
} from "@/lib/documents/sow";
import type { ActionState, SowBuilderInitial } from "@/lib/documents/types";

/**
 * Builder for a customer Statement of Work (Photo Booth Rental Contract). Section
 * 1 (overview) pre-fills from the event; #2 (package inclusions + camera + hours)
 * and #3 (total + payment structure) are set here; #4 terms are static; the
 * client makes the #5 media-release election at signing. Saves as a DRAFT — the
 * team previews and sends it separately. With an existing draft's `documentId`,
 * submits to updateSow instead of createSow.
 */

const FIELD =
  "rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-ink outline-none transition focus:border-navy";

const BLANK_INITIAL: SowBuilderInitial = {
  eventId: null,
  contactId: null,
  companyId: null,
  title: "",
  eventTitle: "",
  eventDate: "",
  startAt: "",
  endAt: "",
  venueName: "",
  guestCount: "",
  clientName: "",
  clientCompany: "",
  signerName: "",
  signerEmail: "",
  packageName: DEFAULT_PACKAGE_NAME,
  cameraType: "standard",
  serviceHours: String(DEFAULT_SERVICE_HOURS),
  setupNote: STANDARD_SETUP_NOTE,
  inclusions: standardBoothInclusions(),
  total: "",
  paymentStructure: "full",
  depositAmount: "",
  notes: "",
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-5 sm:p-6">
      <h2 className="font-display text-lg font-light text-navy">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SowBuilder({
  initial,
}: {
  initial?: SowBuilderInitial | null;
}) {
  const v = initial ?? BLANK_INITIAL;
  const isEdit = !!v.documentId;

  const [state, action, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateSow : createSow,
    undefined,
  );

  const [inclusions, setInclusions] = useState<SowInclusion[]>(() =>
    v.inclusions.length ? v.inclusions : standardBoothInclusions(),
  );
  const [payment, setPayment] = useState<SowPaymentStructure>(
    v.paymentStructure,
  );
  const [total, setTotal] = useState<string>(v.total);
  const [deposit, setDeposit] = useState<string>(v.depositAmount);

  const totalNum = Number(total) || 0;
  const depositNum =
    deposit.trim() !== ""
      ? Math.min(Number(deposit) || 0, totalNum)
      : round2(totalNum / 2);
  const balanceNum = Math.max(0, round2(totalNum - depositNum));

  function setInclusion(i: number, patch: Partial<SowInclusion>) {
    setInclusions((prev) =>
      prev.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    );
  }

  const serializedInclusions = JSON.stringify(
    inclusions.filter((i) => i.label.trim() !== ""),
  );

  return (
    <form action={action} className="grid gap-5">
      {isEdit && <input type="hidden" name="id" value={v.documentId} />}
      <input type="hidden" name="inclusions" value={serializedInclusions} />
      {v.eventId && <input type="hidden" name="event_id" value={v.eventId} />}
      {v.contactId && (
        <input type="hidden" name="contact_id" value={v.contactId} />
      )}
      {v.companyId && (
        <input type="hidden" name="company_id" value={v.companyId} />
      )}

      {/* Document + section 1 — overview */}
      <Section
        title="Event overview"
        hint="Section 1 of the contract — pre-filled from the event."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="eyebrow">Document title</span>
            <input
              name="title"
              type="text"
              required
              defaultValue={v.title}
              placeholder="e.g. Braga Wedding — Statement of Work"
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Event title</span>
            <input
              name="event_title"
              type="text"
              required
              defaultValue={v.eventTitle}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Event date</span>
            <input
              name="event_date"
              type="date"
              defaultValue={v.eventDate}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Client name</span>
            <input
              name="client_name"
              type="text"
              defaultValue={v.clientName}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Client company</span>
            <input
              name="client_company"
              type="text"
              defaultValue={v.clientCompany}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Signer name</span>
            <input
              name="signer_name"
              type="text"
              defaultValue={v.signerName}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Client email (where the SOW is sent)</span>
            <input
              name="signer_email"
              type="email"
              defaultValue={v.signerEmail}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Start</span>
            <input
              name="start_at"
              type="datetime-local"
              defaultValue={v.startAt}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">End</span>
            <input
              name="end_at"
              type="datetime-local"
              defaultValue={v.endAt}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Venue</span>
            <input
              name="venue_name"
              type="text"
              defaultValue={v.venueName}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Guest count</span>
            <input
              name="guest_count"
              type="number"
              min={0}
              step="1"
              defaultValue={v.guestCount}
              className={FIELD}
            />
          </label>
        </div>
      </Section>

      {/* Section 2 — package inclusions & hours */}
      <Section
        title="Package inclusions & hours"
        hint="Section 2 — what the client booked. Edit the deliverables as needed."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Package name</span>
            <input
              name="package_name"
              type="text"
              defaultValue={v.packageName}
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Camera / booth type</span>
            <select
              name="camera_type"
              defaultValue={v.cameraType}
              className={FIELD}
            >
              {CAMERA_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Hours of active service</span>
            <input
              name="service_hours"
              type="number"
              min={0}
              step="1"
              defaultValue={v.serviceHours}
              className={FIELD}
            />
          </label>
        </div>

        <div className="mt-5">
          <span className="eyebrow">Deliverables</span>
          <div className="mt-2 flex flex-col gap-2">
            {inclusions.map((row, i) => (
              <div
                key={i}
                className="grid gap-2 sm:grid-cols-[10rem_1fr_1.75rem] sm:items-center"
              >
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => setInclusion(i, { label: e.target.value })}
                  placeholder="Label (e.g. Prints)"
                  aria-label="Inclusion label"
                  className={`${FIELD} w-full`}
                />
                <input
                  type="text"
                  value={row.detail}
                  onChange={(e) => setInclusion(i, { detail: e.target.value })}
                  placeholder="Detail (e.g. Unlimited photo prints.)"
                  aria-label="Inclusion detail"
                  className={`${FIELD} w-full`}
                />
                <div className="flex justify-end sm:block">
                  <button
                    type="button"
                    onClick={() =>
                      setInclusions((prev) =>
                        prev.length === 1
                          ? prev
                          : prev.filter((_, j) => j !== i),
                      )
                    }
                    disabled={inclusions.length === 1}
                    aria-label="Remove inclusion"
                    className="px-1.5 text-lg leading-none text-muted transition hover:text-red-700 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() =>
                setInclusions((prev) => [...prev, { label: "", detail: "" }])
              }
              className="text-sm font-medium text-navy underline-offset-2 hover:underline"
            >
              + Add deliverable
            </button>
            <button
              type="button"
              onClick={() => setInclusions(standardBoothInclusions())}
              className="text-sm font-medium text-muted underline-offset-2 hover:underline"
            >
              Reset to standard package
            </button>
          </div>
        </div>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="eyebrow">Setup note</span>
          <textarea
            name="setup_note"
            rows={2}
            defaultValue={v.setupNote}
            className={`${FIELD} w-full`}
          />
        </label>
      </Section>

      {/* Section 3 — pricing & payments */}
      <Section
        title="Pricing & payments"
        hint="Section 3 — the total and how it's collected."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Total package cost</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                name="total"
                type="number"
                min={0}
                step="0.01"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
                className={`${FIELD} w-full pl-7`}
              />
            </div>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="eyebrow">Payment structure</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-(--radius-card) border p-3 text-sm transition ${
                payment === "full"
                  ? "border-navy bg-cream"
                  : "border-line hover:border-navy/40"
              }`}
            >
              <input
                type="radio"
                name="payment_structure"
                value="full"
                checked={payment === "full"}
                onChange={() => setPayment("full")}
                className="mt-0.5 h-4 w-4 accent-navy"
              />
              <span>
                <span className="font-medium text-ink">Pay in full</span>
                <span className="block text-xs text-muted">
                  Full payment upfront to reserve the date.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-2 rounded-(--radius-card) border p-3 text-sm transition ${
                payment === "split"
                  ? "border-navy bg-cream"
                  : "border-line hover:border-navy/40"
              }`}
            >
              <input
                type="radio"
                name="payment_structure"
                value="split"
                checked={payment === "split"}
                onChange={() => setPayment("split")}
                className="mt-0.5 h-4 w-4 accent-navy"
              />
              <span>
                <span className="font-medium text-ink">
                  Deposit + balance (50 / 50)
                </span>
                <span className="block text-xs text-muted">
                  Deposit now to reserve, balance one week before the event.
                </span>
              </span>
            </label>
          </div>

          {payment === "split" && (
            <div className="mt-3 rounded-(--radius-card) border border-line bg-cream/50 p-4">
              <label className="flex max-w-xs flex-col gap-1.5">
                <span className="eyebrow">Deposit due up front</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    $
                  </span>
                  <input
                    name="deposit_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    placeholder={round2(totalNum / 2).toFixed(2)}
                    className={`${FIELD} w-full pl-7`}
                  />
                </div>
                <span className="text-xs text-muted">
                  Leave blank to split evenly (half now, half later).
                </span>
              </label>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Deposit — to reserve your date</dt>
                  <dd className="tabular-nums text-ink">
                    {formatMoney(depositNum)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Remaining balance — one week before the event
                  </dt>
                  <dd className="tabular-nums text-ink">
                    {formatMoney(balanceNum)}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </fieldset>
      </Section>

      <Section title="Notes" hint="Anything the client should know before signing.">
        <textarea
          name="notes"
          rows={3}
          defaultValue={v.notes}
          placeholder="Optional"
          className={`${FIELD} w-full`}
        />
      </Section>

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
          {pending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Save draft"}
        </button>
        <span className="text-sm text-muted">
          You&rsquo;ll preview the full document before sending it for signature.
        </span>
      </div>
    </form>
  );
}
