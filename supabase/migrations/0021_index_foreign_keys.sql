-- 0021_index_foreign_keys.sql
-- Performance: add covering indexes for foreign keys flagged by the Supabase
-- performance advisor (lint 0001_unindexed_foreign_keys). Unindexed FK columns
-- force sequential scans on filtered reads/joins and slow FK constraint checks
-- (and ON DELETE cascades) as tables grow. All additive + idempotent — pure
-- speed, no behavior change.
--
-- Scope note: companies.owner_id is intentionally NOT indexed — the company
-- Owner field was removed (ownership lives on contacts), so that column is no
-- longer written or queried; indexing it would only add write overhead.

-- CRM
create index if not exists idx_activities_created_by on public.activities (created_by);
create index if not exists idx_activities_assigned_to on public.activities (assigned_to);
create index if not exists idx_activities_company_id on public.activities (company_id);
create index if not exists idx_companies_created_by on public.companies (created_by);
create index if not exists idx_contacts_owner_id on public.contacts (owner_id);
create index if not exists idx_contacts_created_by on public.contacts (created_by);
create index if not exists idx_deals_created_by on public.deals (created_by);
create index if not exists idx_deals_owner_id on public.deals (owner_id);

-- Events
create index if not exists idx_events_owner_id on public.events (owner_id);
create index if not exists idx_events_contact_id on public.events (contact_id);
create index if not exists idx_events_company_id on public.events (company_id);
create index if not exists idx_events_created_by on public.events (created_by);
create index if not exists idx_event_attachments_uploaded_by on public.event_attachments (uploaded_by);
create index if not exists idx_schedule_entries_created_by on public.schedule_entries (created_by);

-- Inventory
create index if not exists idx_inventory_items_row_id on public.inventory_items (row_id);
create index if not exists idx_inventory_items_created_by on public.inventory_items (created_by);
create index if not exists idx_inventory_items_location_id on public.inventory_items (location_id);
create index if not exists idx_inventory_units_location_id on public.inventory_units (location_id);
create index if not exists idx_inventory_units_row_id on public.inventory_units (row_id);
create index if not exists idx_maintenance_records_created_by on public.maintenance_records (created_by);
create index if not exists idx_maintenance_records_performed_by on public.maintenance_records (performed_by);

-- Accounting
create index if not exists idx_invoices_company_id on public.invoices (company_id);
create index if not exists idx_invoices_contact_id on public.invoices (contact_id);
create index if not exists idx_invoices_created_by on public.invoices (created_by);
create index if not exists idx_payments_created_by on public.payments (created_by);
create index if not exists idx_quotes_created_by on public.quotes (created_by);
create index if not exists idx_quotes_deal_id on public.quotes (deal_id);
create index if not exists idx_quotes_invoice_id on public.quotes (invoice_id);

-- Servicing
create index if not exists idx_service_tickets_contact_id on public.service_tickets (contact_id);
create index if not exists idx_service_tickets_assigned_to on public.service_tickets (assigned_to);
create index if not exists idx_service_tickets_created_by on public.service_tickets (created_by);
create index if not exists idx_ticket_comments_author_id on public.ticket_comments (author_id);

-- Vendors + admin
create index if not exists idx_vendors_created_by on public.vendors (created_by);
create index if not exists idx_user_module_permissions_updated_by on public.user_module_permissions (updated_by);
