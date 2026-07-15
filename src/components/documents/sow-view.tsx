import {
  cameraTypeLabel,
  sowPaymentSchedule,
  sowTermsClauses,
  DEFAULT_PACKAGE_NAME,
  type SowPayload,
} from "@/lib/documents/sow";
import { formatDate, formatMoney } from "@/lib/accounting/format";

/**
 * The full customer SOW rendered on screen — the Photo Booth Rental Contract,
 * section for section. Shared by the public signing page (what the client reads
 * before adopting a signature) and the staff detail page (the draft preview).
 * Purely presentational: the client's media-release election (#5) is made in the
 * signing panel; here it shows as a prompt (unsigned) or the recorded choice.
 */

function formatWindow(start: string | null, end: string | null): string {
  const f = (v: string) =>
    new Date(v).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Los_Angeles",
    });
  if (start && end) return `${f(start)} – ${f(end)}`;
  if (start || end) return f((start ?? end) as string);
  return "—";
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-display text-lg font-light text-navy">
        {n}. {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function SowDocumentView({ payload }: { payload: SowPayload }) {
  const client =
    [payload.clientName, payload.clientCompany].filter(Boolean).join(" · ") ||
    "—";
  const inclusions = payload.inclusions ?? [];
  const camera = cameraTypeLabel(payload.cameraType);
  const schedule = sowPaymentSchedule(payload);

  return (
    <div className="flex flex-col gap-7 text-sm text-ink">
      <Section n={1} title="Parties & Event Overview">
        <p className="text-muted">
          This agreement is made between {payload.companyName} (&ldquo;Company&rdquo;)
          and the undersigned Client (&ldquo;Client&rdquo;).
        </p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Client">{client}</Field>
          <Field label="Event date">{formatDate(payload.eventDate)}</Field>
          <Field label="Event / venue">{payload.venueName ?? "—"}</Field>
          <Field label="Event">{payload.eventTitle}</Field>
          <Field label="Window">
            {formatWindow(payload.startAt, payload.endAt)}
          </Field>
          <Field label="Guests">{payload.guestCount ?? "—"}</Field>
        </dl>
      </Section>

      <Section n={2} title="Package Inclusions & Hours of Service">
        <p>
          The Client is purchasing the{" "}
          <strong>{payload.packageName || DEFAULT_PACKAGE_NAME}</strong>
          {payload.serviceHours != null
            ? `, which includes ${payload.serviceHours} hours of active service`
            : ""}
          {inclusions.length ? ", with the following deliverables:" : "."}
        </p>
        <ul className="mt-3 space-y-1.5">
          {camera && (
            <li>
              <strong>Camera / booth:</strong> {camera}
            </li>
          )}
          {inclusions.map((i, idx) => (
            <li key={`${i.label}-${idx}`}>
              <strong>{i.label}:</strong> {i.detail}
            </li>
          ))}
        </ul>
        {payload.setupNote ? (
          <p className="mt-3 text-muted">Note: {payload.setupNote}</p>
        ) : null}
      </Section>

      <Section n={3} title="Pricing & Payments">
        <div className="flex items-baseline justify-between border-b border-line pb-2">
          <span className="text-muted">Total Package Cost</span>
          <span className="font-display text-2xl font-light text-navy tabular-nums">
            {formatMoney(payload.total)}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {schedule.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-4">
              <span>
                <span className="font-medium text-ink">{s.label}</span>
                <span className="block text-xs text-muted">{s.due}</span>
              </span>
              <span className="tabular-nums text-ink">
                {formatMoney(s.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section n={4} title="Terms and Conditions">
        <ul className="space-y-2">
          {sowTermsClauses().map((c) => (
            <li key={c.heading}>
              <strong>{c.heading}:</strong> {c.body}
            </li>
          ))}
        </ul>
      </Section>

      <Section n={5} title="Social Media & Media Release">
        <p>
          The Client grants the Company permission to use photos and digital media
          captured during the event for promotional, marketing, and social media
          purposes.
        </p>
        {payload.mediaRelease == null ? (
          <p className="mt-2 text-muted">
            The Client selects Yes or No when signing below.
          </p>
        ) : (
          <p className="mt-2 rounded-(--radius-card) border border-line bg-cream px-3 py-2">
            Client&rsquo;s election:{" "}
            <strong>
              {payload.mediaRelease
                ? "YES — I agree to the media release terms."
                : "NO — keep our media private."}
            </strong>
          </p>
        )}
      </Section>

      {payload.notes ? (
        <div>
          <p className="eyebrow">Notes</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">
            {payload.notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
