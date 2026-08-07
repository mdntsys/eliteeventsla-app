-- 0039 — Uploaded-PDF documents (send an externally-authored PDF for signature).
--
-- The e-sign core (0030) only signs PDFs the app GENERATES from a structured
-- payload (affiliate contracts, customer SOWs). This adds the other case: a
-- staff user uploads a finished PDF (e.g. a partnership agreement already signed
-- by our side) and sends it to a third party to counter-sign. Such documents use
-- kind='other'; the whole token / audit / consent / single-use machinery is
-- unchanged. Only two things are new per document:
--
--   * source_path     — the uploaded ORIGINAL PDF in the private `documents`
--                       bucket (`<id>/source.pdf`). The signer reads THIS file;
--                       the executed `<id>/signed.pdf` (existing storage_path) is
--                       produced from it at signing by stamping the signature +
--                       appending a Certificate of Completion.
--   * signature_spec  — where the typed signature lands. NULL means "append a
--                       clean signature page" (works for any PDF). When set, the
--                       signature is stamped in place on an existing page so it
--                       sits in the document's own signature block, e.g. next to
--                       a counterparty who already signed. Shape (fractions of
--                       the page, 0..1 from the TOP-LEFT):
--                         { "page": 6,
--                           "name": { "x": 0.30, "y": 0.34, "size": 15 },
--                           "date": { "x": 0.14, "y": 0.42, "size": 11 } }
--
-- No new enum value: 'other' already exists. A document is an "uploaded" one iff
-- source_path is set.

alter table public.documents
  add column source_path    text,
  add column signature_spec jsonb;
