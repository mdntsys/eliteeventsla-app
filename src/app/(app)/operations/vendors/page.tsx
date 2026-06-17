import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/inventory/status-badge";
import { listVendors, listVendorCategories } from "@/lib/vendors/queries";
import type { VendorListRow } from "@/lib/vendors/types";
import { RatingStars } from "@/components/vendors/rating-stars";
import { NewVendorForm } from "@/components/vendors/new-vendor-form";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireModule("operations");

  const sp = await searchParams;
  const categoryId = sp.category || undefined;

  const [rows, categories] = await Promise.all([
    listVendors(categoryId),
    listVendorCategories(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Vendors"
        description="The external partner network — catering, entertainment, floral, AV and more — with contacts, ratings, preferred flags and the jobs they are tied to."
        action={<NewVendorForm categories={categories} />}
      />

      <div className="flex flex-col gap-6">
        <CategoryFilter
          categories={categories}
          activeId={categoryId ?? null}
        />

        {rows.length === 0 ? (
          <EmptyState filtered={Boolean(categoryId)} />
        ) : (
          <>
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "vendor" : "vendors"}
            </p>
            <VendorTable rows={rows} />
          </>
        )}
      </div>
    </>
  );
}

function CategoryFilter({
  categories,
  activeId,
}: {
  categories: Awaited<ReturnType<typeof listVendorCategories>>;
  activeId: string | null;
}) {
  const pill = (active: boolean) =>
    `inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition ${
      active
        ? "border-navy bg-navy text-cream"
        : "border-line bg-cream text-muted hover:border-navy hover:text-navy"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/operations/vendors" className={pill(activeId === null)}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/operations/vendors?category=${category.id}`}
          className={pill(activeId === category.id)}
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}

function VendorTable({ rows }: { rows: VendorListRow[] }) {
  return (
    <div className="overflow-hidden rounded-(--radius-card) border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Name</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Category</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Rating</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Contact</span>
              </th>
              <th className="px-4 py-3 font-medium text-muted">
                <span className="eyebrow">Status</span>
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted">
                <span className="eyebrow">Events</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line transition last:border-b-0 hover:bg-cream"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/operations/vendors/${row.id}`}
                      className="font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.preferred && <PreferredBadge />}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.category_name ?? <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">
                  <RatingStars rating={row.rating} />
                </td>
                <td className="px-4 py-3">
                  <ContactCell email={row.email} phone={row.phone} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right text-ink tabular-nums">
                  {row.event_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContactCell({
  email,
  phone,
}: {
  email: string | null;
  phone: string | null;
}) {
  if (!email && !phone) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {email && (
        <a
          href={`mailto:${email}`}
          className="text-navy underline-offset-2 hover:underline"
        >
          {email}
        </a>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {phone}
        </a>
      )}
    </div>
  );
}

function PreferredBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      Preferred
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
        <p className="eyebrow">No matches</p>
        <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
          No vendors in this category
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Try another category, or view all vendors.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/operations/vendors"
            className="rounded-(--radius-card) border border-line px-4 py-2 text-sm text-muted transition hover:border-navy hover:text-navy"
          >
            View all vendors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-10 text-center">
      <p className="eyebrow">No vendors yet</p>
      <h2 className="font-display mx-auto mt-2 max-w-md text-2xl font-light text-navy">
        Build your vendor network
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Add your first external partner — caterer, florist, DJ — with their
        contact details and rating, then attach them to events.
      </p>
    </div>
  );
}
