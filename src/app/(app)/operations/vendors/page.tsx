import type { Metadata } from "next";
import Link from "next/link";
import { requireView } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui/page-header";
import { listVendors, listVendorCategories } from "@/lib/vendors/queries";
import { NewVendorForm } from "@/components/vendors/new-vendor-form";
import { VendorBrowser } from "@/components/vendors/vendor-browser";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireView("vendors");

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
          <VendorBrowser rows={rows} />
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
