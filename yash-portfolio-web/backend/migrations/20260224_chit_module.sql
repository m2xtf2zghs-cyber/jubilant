-- Chit Funding ROI module (phase 1)
-- Apply manually to existing databases after core schema initialization.

create table if not exists chits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_code text not null,
  chit_name text not null,
  group_name text,
  organizer text,
  face_value numeric(14,2) not null check (face_value > 0),
  tenure_months integer not null check (tenure_months > 0),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  start_date date not null,
  expected_end_date date not null,
  draw_type text not null check (draw_type in ('AUCTION','LOTTERY','FIXED')),
  draw_date date,
  amount_received numeric(14,2) check (amount_received >= 0 and amount_received <= face_value),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  fees_paid_separately boolean not null default false,
  bank_account_ref text,
  accounting_treatment_mode text not null default 'FINANCING' check (accounting_treatment_mode in ('FINANCING','SAVING_ASSET')),
  status text not null default 'RUNNING' check (status in ('RUNNING','CLOSED','CANCELLED')),
  overdraft_allowed boolean not null default false,
  notes text,
  version integer not null default 1,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, chit_code)
);
create index if not exists idx_chits_org_status on chits (organization_id, status);
create index if not exists idx_chits_org_start on chits (organization_id, start_date);
create index if not exists idx_chits_org_organizer on chits (organization_id, organizer);

create table if not exists chit_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_id uuid not null references chits(id) on delete cascade,
  installment_no integer not null check (installment_no > 0),
  due_date date not null,
  expected_amount numeric(14,2) not null check (expected_amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  status text not null default 'UNPAID' check (status in ('UNPAID','PARTIAL','PAID')),
  last_payment_date timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chit_id, installment_no)
);
create index if not exists idx_chit_installments_org_chit on chit_installments (organization_id, chit_id);
create index if not exists idx_chit_installments_org_due on chit_installments (organization_id, due_date);

create table if not exists chit_installment_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_id uuid not null references chits(id) on delete cascade,
  chit_installment_id uuid not null references chit_installments(id) on delete cascade,
  payment_date timestamptz not null,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  mode text not null default 'BANK',
  reference text,
  narration text,
  linked_bank_ledger_entry_id uuid references ledger_entries(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_chit_payments_org_chit on chit_installment_payments (organization_id, chit_id, payment_date desc);
create index if not exists idx_chit_payments_org_installment on chit_installment_payments (organization_id, chit_installment_id);

create table if not exists chit_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_id uuid not null unique references chits(id) on delete cascade,
  draw_date timestamptz not null,
  amount_received numeric(14,2) not null check (amount_received >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  fees_paid_separately boolean not null default false,
  receipt_mode text not null default 'BANK',
  reference text,
  linked_bank_ledger_entry_id uuid references ledger_entries(id),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chit_receipts_org_draw on chit_receipts (organization_id, draw_date desc);

create table if not exists fund_source_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type text not null check (source_type in ('CHIT','OWN_FUNDS','BANK_LOAN')),
  chit_id uuid references chits(id) on delete restrict,
  allocation_date timestamptz not null,
  amount_allocated numeric(14,2) not null check (amount_allocated > 0),
  purpose text not null check (purpose in ('LENDING','INVENTORY','EXPENSES','ASSET','OTHER')),
  target_entity_type text,
  target_entity_id text,
  linked_loan_id uuid references loans(id),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  check ((source_type = 'CHIT' and chit_id is not null) or (source_type <> 'CHIT'))
);
create index if not exists idx_fund_alloc_org_source on fund_source_allocations (organization_id, source_type, allocation_date desc);
create index if not exists idx_fund_alloc_org_chit on fund_source_allocations (organization_id, chit_id, allocation_date desc);
create index if not exists idx_fund_alloc_org_target on fund_source_allocations (organization_id, target_entity_type, target_entity_id);

create table if not exists chit_capital_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_id uuid not null references chits(id) on delete cascade,
  allocation_id uuid references fund_source_allocations(id) on delete set null,
  return_date timestamptz not null,
  amount_returned numeric(14,2) not null check (amount_returned >= 0),
  source_type text not null check (source_type in ('LOAN_PRINCIPAL_REPAYMENT','BUSINESS_SURPLUS','OTHER')),
  linked_loan_id uuid references loans(id),
  linked_collection_id uuid references collections(id),
  interest_income_amount numeric(14,2) not null default 0 check (interest_income_amount >= 0),
  other_income_amount numeric(14,2) not null default 0 check (other_income_amount >= 0),
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_chit_returns_org_chit on chit_capital_returns (organization_id, chit_id, return_date desc);

create table if not exists chit_journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chit_id uuid not null references chits(id) on delete cascade,
  source_event_type text not null check (source_event_type in ('INSTALLMENT_PAYMENT','RECEIPT','ALLOCATION','RETURN','ADJUSTMENT')),
  source_event_id uuid,
  posting_date timestamptz not null,
  line_no integer not null check (line_no > 0),
  account_code text,
  account_name text not null,
  dr_amount numeric(14,2) not null default 0 check (dr_amount >= 0),
  cr_amount numeric(14,2) not null default 0 check (cr_amount >= 0),
  narration text,
  ledger_entry_id uuid references ledger_entries(id),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, source_event_type, source_event_id, line_no)
);
create index if not exists idx_chit_journal_org_chit on chit_journal_entries (organization_id, chit_id, posting_date desc);

create table if not exists chit_stress_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  reduce_inflows_pct numeric(9,4) not null default 20 check (reduce_inflows_pct >= 0 and reduce_inflows_pct <= 100),
  delay_collections_days integer not null default 60 check (delay_collections_days >= 0),
  increase_defaults_pct numeric(9,4) not null default 10 check (increase_defaults_pct >= 0 and increase_defaults_pct <= 100),
  other_fixed_outflows_monthly numeric(14,2) not null default 0,
  is_default boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chit_stress_org_default on chit_stress_scenarios (organization_id, is_default desc);

