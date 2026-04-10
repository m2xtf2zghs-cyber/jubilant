-- ================================================================
-- Street Smart Lenders — Initial Schema
-- Run this in Supabase SQL Editor after creating your project.
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── User Profiles ──────────────────────────────────────────────
create table if not exists user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  role          text not null default 'VIEW_ONLY'
                check (role in ('ADMIN','CREDIT_MANAGER','COLLECTIONS_OFFICER','DSA_COORDINATOR','VIEW_ONLY')),
  mobile        text,
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Company Settings ────────────────────────────────────────────
create table if not exists company_settings (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null default 'Street Smart Lenders',
  logo_url        text,
  address         text,
  city            text,
  state           text,
  pin             text,
  cin             text,
  gstin           text,
  rbi_nbfc_no     text,
  contact_email   text,
  contact_phone   text,
  website         text,
  updated_at      timestamptz not null default now()
);
insert into company_settings (name) values ('Street Smart Lenders') on conflict do nothing;

-- ── DSAs ───────────────────────────────────────────────────────
create table if not exists dsas (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  name            text not null,
  mobile          text not null,
  email           text,
  pan             text,
  location        text not null,
  commission_rate numeric(5,2) not null default 1.0,
  status          text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  bank_name       text,
  bank_account    text,
  bank_ifsc       text,
  notes           text,
  created_by      uuid references user_profiles(id)
);

-- ── Borrowers ──────────────────────────────────────────────────
create table if not exists borrowers (
  id                      uuid primary key default uuid_generate_v4(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  name                    text not null,
  mobile                  text not null,
  alternate_mobile        text,
  email                   text,
  pan                     text,
  aadhaar                 text,
  dob                     date,
  address                 text,
  city                    text,
  state                   text,
  pincode                 text,
  business_name           text,
  business_type           text,
  business_vintage_years  integer,
  annual_income           numeric(15,2),
  annual_turnover         numeric(15,2),
  cibil_score             integer,
  cibil_date              date,
  photo_url               text,
  notes                   text,
  created_by              uuid references user_profiles(id)
);
create unique index if not exists borrowers_pan_idx on borrowers(pan) where pan is not null;

-- ── Leads ─────────────────────────────────────────────────────
create table if not exists leads (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  borrower_name       text not null,
  mobile              text not null,
  city                text,
  district            text,
  loan_amount         numeric(15,2) not null,
  tenure_months       integer not null,
  purpose             text,
  loan_type           text not null default 'BUSINESS_LOAN'
                      check (loan_type in ('LAP','BUSINESS_LOAN','PERSONAL_LOAN','MSME','OTHER')),
  source_type         text not null default 'DIRECT'
                      check (source_type in ('DSA','DIRECT','REFERRAL','ONLINE')),
  dsa_id              uuid references dsas(id),
  property_details    text,
  status              text not null default 'NEW'
                      check (status in (
                        'NEW','DOCUMENTS_COLLECTED','UNDER_REVIEW','FIELD_VISIT',
                        'SANCTIONED','DISBURSED','REJECTED','ON_HOLD'
                      )),
  assigned_to         uuid references user_profiles(id),
  last_followup_date  date,
  next_followup_date  date,
  pan_number          text,
  aadhaar_last4       text,
  notes               text,
  borrower_id         uuid references borrowers(id),
  created_by          uuid references user_profiles(id)
);
create index if not exists leads_mobile_idx on leads(mobile);
create index if not exists leads_pan_idx on leads(pan_number) where pan_number is not null;
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_idx on leads(created_at desc);

-- ── Documents ──────────────────────────────────────────────────
create table if not exists documents (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  borrower_id     uuid references borrowers(id) on delete cascade,
  loan_id         uuid,
  category        text not null check (category in (
                    'PAN','AADHAAR','BANK_STATEMENT','ITR','GST_RETURN',
                    'PROPERTY_DOCUMENT','BALANCE_SHEET','CIBIL_REPORT',
                    'ELECTRICITY_BILL','PHOTO','PDC_CHEQUE','SANCTION_LETTER','OTHER'
                  )),
  file_url        text,
  file_name       text,
  file_size       bigint,
  status          text not null default 'PENDING'
                  check (status in ('RECEIVED','PENDING','NOT_APPLICABLE')),
  expiry_date     date,
  notes           text,
  uploaded_by     uuid references user_profiles(id)
);
create index if not exists docs_borrower_idx on documents(borrower_id);

-- ── Loans ─────────────────────────────────────────────────────
create table if not exists loans (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  loan_number           text unique not null,
  borrower_id           uuid not null references borrowers(id),
  lead_id               uuid references leads(id),
  dsa_id                uuid references dsas(id),
  loan_type             text not null default 'BUSINESS_LOAN'
                        check (loan_type in ('LAP','BUSINESS_LOAN','PERSONAL_LOAN','MSME','OTHER')),
  principal_amount      numeric(15,2) not null,
  interest_rate         numeric(5,2) not null,
  tenure_months         integer not null,
  repayment_frequency   text not null default 'MONTHLY'
                        check (repayment_frequency in ('MONTHLY','BIWEEKLY','WEEKLY')),
  repayment_mode        text not null default 'NACH'
                        check (repayment_mode in ('PDC','NACH','CASH','UPI','NEFT')),
  processing_fee_pct    numeric(5,2) not null default 0,
  processing_fee_amount numeric(15,2),
  disbursement_date     date,
  disbursement_mode     text check (disbursement_mode in ('CHEQUE','NEFT','RTGS','CASH','UPI')),
  disbursement_utr      text,
  disbursement_amount   numeric(15,2),
  disbursement_bank     text,
  disbursement_account  text,
  emi_amount            numeric(15,2) not null,
  total_amount_payable  numeric(15,2) not null,
  status                text not null default 'SANCTIONED'
                        check (status in ('ACTIVE','CLOSED','NPA','WRITTEN_OFF','SANCTIONED')),
  pre_emi_months        integer default 0,
  bullet_repayment      boolean default false,
  collateral_type       text,
  collateral_value      numeric(15,2),
  property_address      text,
  notes                 text,
  created_by            uuid references user_profiles(id)
);
create index if not exists loans_borrower_idx on loans(borrower_id);
create index if not exists loans_status_idx on loans(status);
create index if not exists loans_disbursement_idx on loans(disbursement_date);

-- ── Repayment Schedule ─────────────────────────────────────────
create table if not exists repayment_schedule (
  id                  uuid primary key default uuid_generate_v4(),
  loan_id             uuid not null references loans(id) on delete cascade,
  instalment_no       integer not null,
  due_date            date not null,
  principal           numeric(15,2) not null,
  interest            numeric(15,2) not null,
  total_emi           numeric(15,2) not null,
  outstanding_balance numeric(15,2) not null,
  status              text not null default 'NOT_PAID'
                      check (status in ('PAID','PARTIAL','NOT_PAID','PTP','DISPUTE')),
  paid_date           date,
  paid_amount         numeric(15,2),
  unique (loan_id, instalment_no)
);
create index if not exists schedule_loan_idx on repayment_schedule(loan_id);
create index if not exists schedule_due_idx on repayment_schedule(due_date);

-- ── Payments ───────────────────────────────────────────────────
create table if not exists payments (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  loan_id         uuid not null references loans(id),
  schedule_id     uuid references repayment_schedule(id),
  instalment_no   integer,
  payment_date    date not null,
  amount          numeric(15,2) not null,
  mode            text not null check (mode in ('PDC','NACH','CASH','UPI','NEFT')),
  reference       text,
  status          text not null check (status in ('PAID','PARTIAL','NOT_PAID','PTP','DISPUTE')),
  ptp_date        date,
  bounce_charge   numeric(10,2),
  penal_interest  numeric(10,2),
  notes           text,
  recorded_by     uuid references user_profiles(id)
);
create index if not exists payments_loan_idx on payments(loan_id);
create index if not exists payments_date_idx on payments(payment_date desc);

-- ── Cheque Details ─────────────────────────────────────────────
create table if not exists cheque_details (
  id                uuid primary key default uuid_generate_v4(),
  loan_id           uuid not null references loans(id) on delete cascade,
  cheque_number     text not null,
  bank_name         text not null,
  branch            text,
  amount            numeric(15,2) not null,
  cheque_date       date not null,
  status            text not null default 'PENDING'
                    check (status in ('PENDING','PRESENTED','BOUNCED','CLEARED')),
  bounce_date       date,
  bounce_reason     text,
  legal_notice_sent boolean default false,
  notice_date       date
);
create index if not exists cheque_loan_idx on cheque_details(loan_id);

-- ── DSA Commissions ────────────────────────────────────────────
create table if not exists dsa_commissions (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  dsa_id              uuid not null references dsas(id),
  loan_id             uuid not null references loans(id),
  disbursement_amount numeric(15,2) not null,
  commission_rate     numeric(5,2) not null,
  commission_amount   numeric(15,2) not null,
  status              text not null default 'PENDING' check (status in ('PENDING','PAID')),
  paid_date           date,
  payment_reference   text
);

-- ── Field Visits ───────────────────────────────────────────────
create table if not exists field_visits (
  id                      uuid primary key default uuid_generate_v4(),
  created_at              timestamptz not null default now(),
  lead_id                 uuid references leads(id),
  borrower_id             uuid references borrowers(id),
  loan_id                 uuid references loans(id),
  visit_date              date not null,
  visited_by              uuid references user_profiles(id),
  photos                  text[],
  employee_count          integer,
  daily_footfall          text,
  stock_observation       text,
  neighborhood_assessment text,
  signage_check           boolean,
  overall_remarks         text,
  recommendation          text not null check (recommendation in ('POSITIVE','NEGATIVE','NEUTRAL')),
  gps_lat                 numeric(10,6),
  gps_lng                 numeric(10,6)
);

-- ── Alerts ────────────────────────────────────────────────────
create table if not exists alerts (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  type            text not null,
  title           text not null,
  message         text,
  entity_type     text,
  entity_id       uuid,
  assigned_to     uuid references user_profiles(id),
  is_read         boolean not null default false,
  due_date        date,
  priority        text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT'))
);
create index if not exists alerts_assigned_idx on alerts(assigned_to, is_read);

-- ── Communication Log ──────────────────────────────────────────
create table if not exists communication_log (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  entity_type     text not null,
  entity_id       uuid not null,
  type            text not null check (type in ('CALL','WHATSAPP','EMAIL','VISIT','NOTE','SMS')),
  direction       text check (direction in ('INBOUND','OUTBOUND')),
  summary         text not null,
  outcome         text,
  next_action     text,
  next_action_date date,
  created_by      uuid references user_profiles(id)
);
create index if not exists commlog_entity_idx on communication_log(entity_type, entity_id);

-- ────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────
alter table user_profiles enable row level security;
alter table leads enable row level security;
alter table borrowers enable row level security;
alter table loans enable row level security;
alter table repayment_schedule enable row level security;
alter table payments enable row level security;
alter table documents enable row level security;
alter table dsas enable row level security;
alter table dsa_commissions enable row level security;
alter table field_visits enable row level security;
alter table cheque_details enable row level security;
alter table alerts enable row level security;
alter table communication_log enable row level security;
alter table company_settings enable row level security;

-- User profiles: each user sees their own row; admins see all
create policy "Users can view their own profile"
  on user_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on user_profiles for update
  using (auth.uid() = id);

-- Authenticated users can read/write all operational tables
-- (In production, tighten to role-based policies per module)
create policy "Authenticated users can read leads"
  on leads for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert leads"
  on leads for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update leads"
  on leads for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read borrowers"
  on borrowers for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert borrowers"
  on borrowers for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update borrowers"
  on borrowers for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read loans"
  on loans for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert loans"
  on loans for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update loans"
  on loans for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read schedule"
  on repayment_schedule for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert schedule"
  on repayment_schedule for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update schedule"
  on repayment_schedule for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read payments"
  on payments for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert payments"
  on payments for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update payments"
  on payments for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read documents"
  on documents for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert documents"
  on documents for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update documents"
  on documents for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read dsas"
  on dsas for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert dsas"
  on dsas for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update dsas"
  on dsas for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read dsa_commissions"
  on dsa_commissions for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert dsa_commissions"
  on dsa_commissions for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update dsa_commissions"
  on dsa_commissions for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read field_visits"
  on field_visits for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert field_visits"
  on field_visits for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can read cheque_details"
  on cheque_details for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert cheque_details"
  on cheque_details for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update cheque_details"
  on cheque_details for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read alerts"
  on alerts for select using (auth.role() = 'authenticated');
create policy "Authenticated users can update alerts"
  on alerts for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read communication_log"
  on communication_log for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert communication_log"
  on communication_log for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can read company_settings"
  on company_settings for select using (auth.role() = 'authenticated');
create policy "Admins can update company_settings"
  on company_settings for update
  using (exists (
    select 1 from user_profiles where id = auth.uid() and role = 'ADMIN'
  ));

-- ── Enable Realtime for live dashboard ─────────────────────────
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table loans;

-- ── Loan number sequence ────────────────────────────────────────
create sequence if not exists loan_seq start 1000;

create or replace function generate_loan_number()
returns text as $$
begin
  return 'SSL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('loan_seq')::text, 5, '0');
end;
$$ language plpgsql;

-- Auto-set loan_number on insert if not provided
create or replace function set_loan_number()
returns trigger as $$
begin
  if new.loan_number is null or new.loan_number = '' then
    new.loan_number = generate_loan_number();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger loans_set_loan_number
  before insert on loans
  for each row execute function set_loan_number();

-- Auto-set updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

create trigger loans_updated_at
  before update on loans
  for each row execute function set_updated_at();

create trigger borrowers_updated_at
  before update on borrowers
  for each row execute function set_updated_at();

-- ── Storage bucket ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Auth users can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Auth users can read documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');
