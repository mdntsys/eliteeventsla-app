-- 0033 — Customer SOW media-release consent on the contact profile.
--
-- The Standard Booth Package contract (customer SOW) asks the client to elect,
-- at signing, whether they grant Elite Events LA permission to use event photos
-- for marketing / social media (a YES/NO "media release"). That election is the
-- CLIENT's to make and is captured on the public signing page. On sign, the
-- choice is denormalized onto the linked contact so that:
--   • sales/ops can see a client's standing preference on the CRM profile, and
--   • onsite crew can see, straight from the event, whether they may capture and
--     share images — without opening the signed document.
--
-- Written only by the token-scoped signing flow via the service-role client
-- (documents.contact_id → contacts.id). NULL = not yet answered. The existing
-- contacts RLS (0002) governs read visibility; these columns inherit it, so no
-- new policy is required.
alter table public.contacts
  add column media_release_consent boolean,
  add column media_release_recorded_at timestamptz,
  add column media_release_document_id uuid references public.documents(id) on delete set null;

comment on column public.contacts.media_release_consent is
  'Client''s media-release election from their signed SOW: true = may use/share event media, false = keep private, null = not yet answered.';
