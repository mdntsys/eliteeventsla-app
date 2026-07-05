-- 0030 — Documents + e-signature core (Phase 3).
--
-- One central store for every signable document (affiliate contracts + customer
-- SOWs). A document is generated from a structured payload (snapshotted so the
-- signed copy is immutable), sent for signature via an unguessable, EXPIRING,
-- SINGLE-USE token, signed with captured consent + a tamper-evident audit trail
-- (name, email, IP, user-agent, UTC time, content hash), and the executed PDF is
-- stored in a private bucket. document_audit is an append-only evidence log.

create type public.document_kind as enum (
  'affiliate_contract',
  'customer_sow',
  'other'
);
create type public.document_status as enum (
  'draft',
  'sent',
  'viewed',
  'signed',
  'voided'
);

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  kind              public.document_kind not null,
  title             text not null,
  status            public.document_status not null default 'draft',
  -- Who/what the document is about (nullable; affiliate contracts set
  -- affiliate_id, customer SOWs set event/contact/company).
  affiliate_id      uuid references public.affiliates(id) on delete cascade,
  event_id          uuid references public.events(id) on delete set null,
  contact_id        uuid references public.contacts(id) on delete set null,
  company_id        uuid references public.companies(id) on delete set null,
  -- The intended signer (auto-filled; the signer only clicks to adopt).
  signer_name       text,
  signer_email      text,
  -- Immutable snapshot of the structured data the document renders from.
  payload           jsonb not null default '{}'::jsonb,
  -- Signing link: unguessable bearer token, expiring + single-use.
  sign_token        text unique,
  token_expires_at  timestamptz,
  -- Signature + tamper-evidence, captured at signing.
  viewed_at         timestamptz,
  signed_at         timestamptz,
  signer_ip         text,
  signer_user_agent text,
  signature_name    text,
  content_hash      text,
  storage_path      text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index documents_affiliate_id_idx on public.documents (affiliate_id);
create index documents_event_id_idx on public.documents (event_id);
create index documents_status_idx on public.documents (status);
create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- Append-only signing/lifecycle evidence.
create table public.document_audit (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  event       text not null,
  actor       text,
  ip          text,
  user_agent  text,
  meta        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index document_audit_document_id_idx on public.document_audit (document_id);

-- Private bucket for executed PDFs (served only via short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- New 'documents' internal area.
alter table public.user_module_permissions
  drop constraint user_module_permissions_module_check;
alter table public.user_module_permissions
  add constraint user_module_permissions_module_check
  check (module in ('dashboard', 'crm', 'quotes', 'events', 'inventory',
                    'scheduling', 'vendors', 'servicing', 'accounting',
                    'affiliates', 'documents'));

create or replace function public.can_view_module(m text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when p.id is null or not p.is_active then false
    when p.is_super_admin then true
    when ov.user_id is not null then (ov.can_view or ov.can_edit)
    when p.role = 'admin' then true
    when p.role = 'sales' then m in ('dashboard','crm','quotes','events','affiliates','documents')
    when p.role = 'ops' then m in ('dashboard','events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('dashboard','accounting','events','affiliates','documents')
    else false
  end
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid
  left join public.user_module_permissions ov on ov.user_id = u.uid and ov.module = m;
$$;

create or replace function public.can_edit_module(m text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when p.id is null or not p.is_active then false
    when p.is_super_admin then true
    when ov.user_id is not null then ov.can_edit
    when p.role = 'admin' then true
    when p.role = 'sales' then m in ('crm','quotes','events','affiliates','documents')
    when p.role = 'ops' then m in ('events','inventory','scheduling','vendors','servicing')
    when p.role = 'accounting' then m in ('accounting','affiliates','documents')
    else false
  end
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid
  left join public.user_module_permissions ov on ov.user_id = u.uid and ov.module = m;
$$;

-- RLS. Staff manage via the 'documents' area; an affiliate can READ ONLY their
-- own documents (owner-scoped). The public signing flow reads/writes via the
-- service-role client (scoped to one token), so no anon policy is needed.
alter table public.documents enable row level security;
create policy documents_select on public.documents
  for select to authenticated
  using (public.can_view_module('documents')
         or affiliate_id = public.current_affiliate_id());
create policy documents_write on public.documents
  for all to authenticated
  using (public.can_edit_module('documents'))
  with check (public.can_edit_module('documents'));

alter table public.document_audit enable row level security;
create policy document_audit_select on public.document_audit
  for select to authenticated
  using (
    public.can_view_module('documents')
    or exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.affiliate_id = public.current_affiliate_id()
    )
  );
create policy document_audit_write on public.document_audit
  for all to authenticated
  using (public.can_edit_module('documents'))
  with check (public.can_edit_module('documents'));

grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.document_audit to authenticated;

-- Private documents bucket: staff (documents area) read/write; affiliates get
-- their signed PDF via a service-role signed URL from the portal loader.
create policy documents_bucket_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.can_view_module('documents'));
create policy documents_bucket_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.can_edit_module('documents'));
create policy documents_bucket_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.can_edit_module('documents'));
create policy documents_bucket_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.can_edit_module('documents'));
