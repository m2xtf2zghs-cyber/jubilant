-- Statement Autopilot V2 core schema (FastAPI backend)
create extension if not exists "pgcrypto";

create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null,
  bank_name text null,
  account_type text null,
  account_no_masked text null,
  created_by uuid null,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'statement_version_status') then
    create type public.statement_version_status as enum (
      'UPLOADED',
      'PARSING',
      'PARSE_FAILED',
      'READY',
      'APPROVED',
      'REJECTED'
    );
  end if;
end
$$;

create table if not exists public.statement_versions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid references public.statements(id) on delete cascade,
  version_no int not null default 1,
  status public.statement_version_status not null default 'UPLOADED',
  period_from date null,
  period_to date null,
  parse_hash text null,
  run_by uuid null,
  run_at timestamptz null,
  unmapped_txn_lines int not null default 0,
  continuity_failures int not null default 0,
  pdf_url text null,
  excel_url text null,
  created_at timestamptz default now(),
  unique(statement_id, version_no)
);

create table if not exists public.pdf_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'raw_line_type') then
    create type public.raw_line_type as enum ('TRANSACTION', 'NON_TXN_LINE');
  end if;
end
$$;

create table if not exists public.raw_statement_lines (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  pdf_file_id uuid references public.pdf_files(id) on delete cascade,
  page_no int not null,
  row_no int not null,
  raw_row_text text not null,
  raw_date_text text null,
  raw_narration_text text null,
  raw_dr_text text null,
  raw_cr_text text null,
  raw_balance_text text null,
  line_type public.raw_line_type not null,
  extraction_method text not null,
  bbox_json jsonb null,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  raw_line_ids uuid[] not null,
  txn_date date not null,
  month_key text not null,
  narration text not null,
  dr numeric(18,2) not null default 0,
  cr numeric(18,2) not null default 0,
  balance numeric(18,2) null,
  counterparty_norm text null,
  txn_type text null,
  category text null,
  flags jsonb not null default '[]'::jsonb,
  transaction_uid text not null,
  created_at timestamptz default now(),
  unique(version_id, transaction_uid)
);

create table if not exists public.aggregates_monthly (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  month_key text not null,
  kpis jsonb not null,
  created_at timestamptz default now(),
  unique(version_id, month_key)
);

create table if not exists public.pivots (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  month_key text not null,
  category text not null,
  txn_type text not null,
  sum_dr numeric(18,2) not null default 0,
  sum_cr numeric(18,2) not null default 0,
  count_dr int not null default 0,
  count_cr int not null default 0,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'approval_decision') then
    create type public.approval_decision as enum ('APPROVED', 'REJECTED', 'CONDITIONAL');
  end if;
end
$$;

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.statement_versions(id) on delete cascade,
  decision public.approval_decision not null,
  decision_by uuid null,
  decision_at timestamptz default now(),
  comments text null,
  conditions jsonb null
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid null,
  payload jsonb null,
  created_at timestamptz default now()
);

notify pgrst, 'reload schema';
