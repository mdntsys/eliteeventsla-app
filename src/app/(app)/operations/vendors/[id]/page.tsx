import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/dal";
import { getVendor, listVendorCategories } from "@/lib/vendors/queries";
import type { VendorEventRow } from "@/lib/vendors/types";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { RatingStars } from "@/components/vendors/rating-stars";
import { VendorEditForm } from "@/components/vendors/vendor-edit-form";

export const metadata: Metadata = { title: "Vendor" };

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-sm text-ink">{children}</p>
    </div>
  );
}

function PreferredBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      Preferred
    </span>
  );
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireView("vendors");
  const { id } = await params;

  const [vendor, categories] = await Promise.all([
    getVendor(id),
    listVendorCategories(),
  ]);
  if (!vendor) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Operations / Vendors"
        title={vendor.name}
        description={vendor.category_name ?? undefined}
        action={
          <Link
            href="/operations/vendors"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            Back to vendors
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <section className="rounded-(--radius-card) border border-line bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={vendor.status} />
              {vendor.preferred && <PreferredBadge />}
              <RatingStars rating={vendor.rating} />
            </div>
            <VendorEditForm vendor={vendor} categories={categories} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="Category">
              {vendor.category_name ?? "—"}
            </SummaryField>
            <SummaryField label="Contact">
              {vendor.contact_name ?? "—"}
            </SummaryField>
            <SummaryField label="Email">
              {vendor.email ? (
                <a
                  href={`mailto:${vendor.email}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {vendor.email}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Phone">
              {vendor.phone ? (
                <a
                  href={`tel:${vendor.phone}`}
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {vendor.phone}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Website">
              {vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-navy underline-offset-2 hover:underline"
                >
                  {vendor.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              )}
            </SummaryField>
            <SummaryField label="Address">
              {vendor.address ?? "—"}
            </SummaryField>
          </div>

          {vendor.notes && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="eyebrow">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {vendor.notes}
              </p>
            </div>
          )}
        </section>

        <TiedEvents events={vendor.events} />
      </div>
    </>
  );
}

function TiedEvents({ events }: { events: VendorEventRow[] }) {
  return (
    <section className="rounded-(--radius-card) border border-line bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl font-light text-navy">
          Tied to these events
        </h2>
        <span className="eyebrow">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-line bg-cream px-4 py-6 text-center text-sm text-muted">
          This vendor is not attached to any events yet.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-(--radius-card) border border-line">
          {events.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-4 bg-cream px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/events/${row.event_id}`}
                  className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                >
                  {row.event_title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(row.event_date)}
                  {row.service ? ` · ${row.service}` : ""}
                  {row.agreed_cost != null
                    ? ` · ${formatCurrency(row.agreed_cost)}`
                    : ""}
                </p>
              </div>
              <div className="shrink-0">
                <StatusBadge status={row.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
