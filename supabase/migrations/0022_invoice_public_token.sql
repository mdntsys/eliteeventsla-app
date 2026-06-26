-- 0022_invoice_public_token.sql
-- Public, shareable invoice pages. Each invoice gets an unguessable token used
-- in the client-facing /i/<token> URL (the invoice page, its PDF, and its
-- checkout). The token IS the bearer credential for that one invoice; the
-- public surfaces look it up via the service-role client (RLS stays untouched —
-- we deliberately do NOT add an anon SELECT policy, which would expose every
-- invoice). Volatile default backfills existing rows with distinct values.

alter table public.invoices
  add column if not exists public_token text not null
    default (
      replace(gen_random_uuid()::text, '-', '') ||
      replace(gen_random_uuid()::text, '-', '')
    );

create unique index if not exists invoices_public_token_key
  on public.invoices (public_token);
