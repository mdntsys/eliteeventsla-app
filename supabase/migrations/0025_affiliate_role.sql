-- 0025 — Add the external 'affiliate' role to app_role.
--
-- Affiliates are external partners with a real login but their OWN lightweight
-- portal and ZERO internal-area access. This only adds the enum value; it is
-- deliberately its own migration and does not USE the value (safe inside a
-- transaction). Row-ownership helpers + the affiliates table land next.
--
-- Enum values are one-way in Postgres (cannot be removed) — intentional.

alter type public.app_role add value if not exists 'affiliate';
