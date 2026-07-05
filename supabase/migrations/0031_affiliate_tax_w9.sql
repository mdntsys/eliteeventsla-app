-- 0031 — Affiliate tax compliance (Phase 7): W-9 collection + 1099 readiness.
--
-- The signed commission agreement requires a completed IRS Form W-9 "before any
-- payout". This adds an ISOLATED, super-admin-only store for that document — never
-- exposed to the portal or ordinary staff, exactly like the EIN in 0027 — plus a
-- NON-sensitive `w9_on_file` flag on affiliates so staff and the payout gate can
-- see WHETHER a W-9 exists without reading the document itself. 1099 totals are
-- derived from the existing payout ledger (cash paid per calendar year), so no
-- new amount column is needed.

-- (1) Non-sensitive presence flag. Readable wherever the affiliate row is (the
-- owner-scoped affiliates_select RLS from 0027 already governs visibility).
-- Maintained by the W-9 upload/remove actions via the service-role client.
alter table public.affiliates
  add column w9_on_file boolean not null default false;

-- (2) The W-9 document metadata lives in the super-admin-only affiliate_private
-- store (0027); the bytes live in a private bucket. Written only via service role.
alter table public.affiliate_private
  add column w9_path text,
  add column w9_filename text,
  add column w9_uploaded_at timestamptz;

-- (3) Isolated private bucket for W-9 files. NO authenticated storage policy is
-- created on purpose: the bucket is reachable ONLY through the service-role client
-- (upload + short-lived signed URLs), gated in-app by requireSuperAdmin. Because
-- storage.objects has RLS enabled with no matching policy, even a leaked
-- anon/authenticated key cannot read or list it — defense in depth for a document
-- that may carry a taxpayer id.
insert into storage.buckets (id, name, public)
values ('affiliate-tax', 'affiliate-tax', false)
on conflict (id) do nothing;
