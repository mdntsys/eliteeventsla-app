/**
 * Placeholder body for a scaffolded module route. Lists the planned capabilities
 * so the nav + role gating can be exercised before the real CRUD lands.
 */
export function ModulePlaceholder({ items }: { items: string[] }) {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-card p-8">
      <p className="eyebrow">Scaffolded</p>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This module is wired into the app shell and protected by role-based
        access and Postgres RLS. Data tables, forms, and detail views arrive in
        the next build pass. Planned here:
      </p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-(--radius-card) border border-line bg-cream px-3.5 py-2.5 text-sm text-ink"
          >
            <span aria-hidden className="text-muted">
              —
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
