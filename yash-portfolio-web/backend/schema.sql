-- Yash Portfolio Backend Schema (PostgreSQL 15+)
-- Multi-user, audit-friendly, mobile sync ready.

create extension if not exists pgcrypto;

create type user_role as enum ('OWNER', 'ACCOUNTS_OFFICER', 'COLLECTION_AGENT', 'AUDITOR', 'VIEWER');
create type client_risk_grade as enum ('STANDARD', 'WATCH', 'HIGH_RISK');
create type loan_status as enum ('DRAFT', 'ACTIVE', 'CLOSED', 'WRITTEN_OFF', 'CANCELLED');
create type installment_status as enum ('PENDING', 'PARTIAL', 'PAID', 'BAD_DEBT', 'CLOSED');
create type tx_type as enum ('DEBIT', 'CREDIT');
create type ledger_tag as enum ('CAPITAL', 'LENDING', 'COLLECTION', 'EXPENSE', 'BAD_DEBT', 'ADJUSTMENT');
create type reminder_channel as enum ('SMS', 'WHATSAPP', 'CALL', 'EMAIL');
create type sync_event_type as enum ('UPSERT_CLIENT', 'UPSERT_LOAN', 'UPSERT_INSTALLMENT', 'RECORD_COLLECTION', 'RECORD_EXPENSE', 'MANUAL_LEDGER', 'CLOSE_LOAN');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  base_currency char(3) not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text not null,
  password_hash text not null,
  role user_role not null,
  is_active boolean not null default true,
  phone text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  device_label text not null,
  platform text not null check (platform in ('ANDROID', 'WEB')),
  app_version text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_code text not null,
  name text not null,
  phone text,
  alt_phone text,
  kyc_ref text,
  kyc_type text,
  address_line text,
  locality text,
  city text,
  state text,
  postal_code text,
  risk_grade client_risk_grade not null default 'STANDARD',
  notes text,
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_code)
);
create index idx_clients_org_name on clients (organization_id, name);
create index idx_clients_org_phone on clients (organization_id, phone);

create table loan_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  frequency_code text not null check (frequency_code in ('WEEKLY','BI_WEEKLY','BI_MONTHLY','MONTHLY')),
  default_installments integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id),
  loan_number text not null,
  product_id uuid references loan_products(id),
  status loan_status not null default 'ACTIVE',
  principal_amount numeric(14,2) not null check (principal_amount > 0),
  interest_amount numeric(14,2) not null default 0 check (interest_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount >= principal_amount),
  effective_rate_percent numeric(10,4),
  frequency_code text not null check (frequency_code in ('WEEKLY','BI_WEEKLY','BI_MONTHLY','MONTHLY')),
  installment_count integer not null check (installment_count > 0),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  disbursed_at timestamptz not null,
  first_due_date date not null,
  purpose text,
  loan_notes text,
  disbursement_mode text,
  agent_user_id uuid references users(id),
  closed_at timestamptz,
  closed_reason text,
  writeoff_amount numeric(14,2) not null default 0,
  version integer not null default 1,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, loan_number)
);
create index idx_loans_org_status on loans (organization_id, status);
create index idx_loans_org_client on loans (organization_id, client_id);

create table installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  scheduled_amount numeric(14,2) not null check (scheduled_amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status installment_status not null default 'PENDING',
  paid_at timestamptz,
  last_collection_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loan_id, installment_no)
);
create index idx_installments_org_due_status on installments (organization_id, due_date, status);
create index idx_installments_org_loan on installments (organization_id, loan_id);

create table collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  loan_id uuid not null references loans(id),
  installment_id uuid references installments(id),
  client_id uuid not null references clients(id),
  amount numeric(14,2) not null check (amount >= 0),
  cash_received_amount numeric(14,2) not null check (cash_received_amount >= 0),
  tds_deducted_amount numeric(14,2) not null default 0 check (tds_deducted_amount >= 0),
  principal_component numeric(14,2),
  interest_component numeric(14,2),
  split_method text,
  collection_date timestamptz not null,
  payment_mode text not null default 'CASH',
  receipt_number text,
  is_partial boolean not null default false,
  is_writeoff boolean not null default false,
  notes text,
  agent_user_id uuid references users(id),
  idempotency_key text,
  source_device_id uuid references devices(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index idx_collections_org_date on collections (organization_id, collection_date);
create index idx_collections_org_client on collections (organization_id, client_id);

alter table installments
  add constraint fk_installments_last_collection
  foreign key (last_collection_id) references collections(id);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  expense_date timestamptz not null,
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_mode text not null default 'CASH',
  vendor_name text,
  idempotency_key text,
  source_device_id uuid references devices(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index idx_expenses_org_date on expenses (organization_id, expense_date);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entry_time timestamptz not null,
  tx_type tx_type not null,
  tag ledger_tag not null,
  amount numeric(14,2) not null check (amount >= 0),
  description text not null,
  category text,
  client_id uuid references clients(id),
  loan_id uuid references loans(id),
  collection_id uuid references collections(id),
  expense_id uuid references expenses(id),
  manual_reference text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_ledger_org_time on ledger_entries (organization_id, entry_time desc);
create index idx_ledger_org_tag on ledger_entries (organization_id, tag);

create table opening_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  effective_date date not null,
  amount numeric(14,2) not null,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, effective_date)
);

create table reminder_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id),
  loan_id uuid references loans(id),
  installment_id uuid references installments(id),
  channel reminder_channel not null,
  template_code text not null,
  message_body text not null,
  sent_to text,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  sent_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_reminders_org_created on reminder_logs (organization_id, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references users(id),
  device_id uuid references devices(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_org_created on audit_logs (organization_id, created_at desc);
create index idx_audit_org_entity on audit_logs (organization_id, entity_type, entity_id);

create table sync_outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  device_id uuid references devices(id),
  user_id uuid references users(id),
  event_type sync_event_type not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null,
  client_event_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'RECEIVED' check (processing_status in ('RECEIVED', 'PROCESSED', 'REJECTED')),
  error_message text,
  unique (organization_id, client_event_id)
);
create index idx_sync_events_org_status on sync_outbox_events (organization_id, processing_status, received_at);

-- Suggested operational views (can be materialized later)
-- 1) receivables_aging_view (by buckets)
-- 2) par30_view
-- 3) collection_efficiency_month_view
