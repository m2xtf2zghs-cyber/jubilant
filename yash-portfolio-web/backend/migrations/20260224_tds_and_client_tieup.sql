-- TDS tracking + client funding channel/tie-up tagging

alter table clients
  add column if not exists funding_channel text not null default 'DIRECT';

alter table clients
  add column if not exists tie_up_partner_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_clients_funding_channel'
  ) then
    alter table clients
      add constraint chk_clients_funding_channel
      check (funding_channel in ('DIRECT','TIE_UP'));
  end if;
end $$;

create table if not exists client_tds_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id),
  loan_id uuid references loans(id),
  collection_id uuid references collections(id),
  deduction_date date not null,
  period_month char(7), -- YYYY-MM
  gross_emi_amount numeric(14,2) not null default 0 check (gross_emi_amount >= 0),
  cash_received_amount numeric(14,2) not null default 0 check (cash_received_amount >= 0),
  tds_rate_percent numeric(8,4) check (tds_rate_percent >= 0),
  tds_amount numeric(14,2) not null check (tds_amount >= 0),
  receipt_status text not null default 'PENDING',
  received_date date,
  certificate_ref text,
  source_type text not null default 'CLIENT_COLLECTION',
  client_funding_channel_snapshot text,
  tie_up_partner_name_snapshot text,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_client_tds_receipt_status check (receipt_status in ('PENDING','RECEIVED')),
  constraint chk_client_tds_source_type check (source_type in ('CLIENT_COLLECTION','TIE_UP_SETTLEMENT','MANUAL')),
  constraint chk_client_tds_period_month_format check (period_month is null or period_month ~ '^\d{4}-\d{2}$'),
  constraint chk_client_tds_collection_client_match check (collection_id is null or client_id is not null)
);

create index if not exists idx_client_tds_org_client on client_tds_entries (organization_id, client_id, deduction_date desc);
create index if not exists idx_client_tds_org_status on client_tds_entries (organization_id, receipt_status, deduction_date desc);
create index if not exists idx_client_tds_org_period on client_tds_entries (organization_id, period_month);
create unique index if not exists uq_client_tds_org_collection on client_tds_entries (organization_id, collection_id) where collection_id is not null;
