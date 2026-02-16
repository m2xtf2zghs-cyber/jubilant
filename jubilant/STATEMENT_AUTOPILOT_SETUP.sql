-- Statement Autopilot schema (strict transaction capture + reconciliation)
create extension if not exists "pgcrypto";

-- Statements (one per lead/account)
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  account_id text,
  created_at timestamptz not null default now()
);

-- Statement versions (v1/v2/v3)
create table if not exists public.statement_versions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'DRAFT',
  version_no int not null default 1,
  bank_name text,
  account_type text,
  period_start date,
  period_end date,
  report_json jsonb,
  created_at timestamptz not null default now()
);

-- Raw PDF files
create table if not exists public.pdf_files (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null,
  file_name text,
  meta_json jsonb,
  created_at timestamptz not null default now()
);

-- Raw statement lines (STRICT capture)
create table if not exists public.raw_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  pdf_file_id uuid references public.pdf_files(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  page_no int not null,
  row_no int not null,
  raw_row_text text not null,
  raw_date_text text,
  raw_narration_text text,
  raw_dr_text text,
  raw_cr_text text,
  raw_balance_text text,
  raw_line_type text not null default 'NON_TXN_LINE',
  extraction_method text,
  bbox_json jsonb,
  created_at timestamptz not null default now()
);

-- Normalized transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  raw_line_ids jsonb not null default '[]'::jsonb,
  date date not null,
  month text not null,
  narration text,
  dr bigint not null default 0,
  cr bigint not null default 0,
  balance bigint,
  counterparty_norm text,
  txn_type text,
  category text,
  flags_json jsonb,
  transaction_uid text not null,
  created_at timestamptz not null default now()
);

-- Monthly aggregates
create table if not exists public.aggregates_monthly (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  month text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Pivots / analysis
create table if not exists public.pivots (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  pivot_type text not null,
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Risk items + evidence
create table if not exists public.risk_items (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  code text,
  severity text,
  description text,
  evidence_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pinned_evidence (
  id uuid primary key default gen_random_uuid(),
  risk_item_id uuid not null references public.risk_items(id) on delete cascade,
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  raw_line_id uuid references public.raw_statement_lines(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- Approval workflow
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'DRAFT',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Reconciliation failures
create table if not exists public.reconciliation_failures (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  unmapped_line_ids jsonb not null default '[]'::jsonb,
  continuity_failures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Manual mapping sessions/actions
create table if not exists public.manual_mapping_sessions (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table if not exists public.manual_mapping_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.manual_mapping_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  action_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Collections calendar suggestion
create table if not exists public.collections_calendar_suggestions (
  id uuid primary key default gen_random_uuid(),
  statement_version_id uuid not null references public.statement_versions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  suggestion_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Audit events (generic)
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  diff_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.raw_statement_lines
  add column if not exists pdf_file_id uuid references public.pdf_files(id) on delete set null;

-- RLS
alter table public.statements enable row level security;
alter table public.statement_versions enable row level security;
alter table public.pdf_files enable row level security;
alter table public.raw_statement_lines enable row level security;
alter table public.transactions enable row level security;
alter table public.aggregates_monthly enable row level security;
alter table public.pivots enable row level security;
alter table public.risk_items enable row level security;
alter table public.pinned_evidence enable row level security;
alter table public.approvals enable row level security;
alter table public.reconciliation_failures enable row level security;
alter table public.manual_mapping_sessions enable row level security;
alter table public.manual_mapping_actions enable row level security;
alter table public.collections_calendar_suggestions enable row level security;
alter table public.audit_events enable row level security;

-- Policies: owner or admin
create policy "statements: read own or admin" on public.statements
for select using (owner_id = auth.uid() or public.is_admin());
create policy "statements: insert own or admin" on public.statements
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());
create policy "statements: update own or admin" on public.statements
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "statement_versions: read own or admin" on public.statement_versions
for select using (owner_id = auth.uid() or public.is_admin());
create policy "statement_versions: insert own or admin" on public.statement_versions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());
create policy "statement_versions: update own or admin" on public.statement_versions
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy "pdf_files: read own or admin" on public.pdf_files
for select using (owner_id = auth.uid() or public.is_admin());
create policy "pdf_files: insert own or admin" on public.pdf_files
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "raw_statement_lines: read own or admin" on public.raw_statement_lines
for select using (owner_id = auth.uid() or public.is_admin());
create policy "raw_statement_lines: insert own or admin" on public.raw_statement_lines
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "transactions: read own or admin" on public.transactions
for select using (owner_id = auth.uid() or public.is_admin());
create policy "transactions: insert own or admin" on public.transactions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "audit_events: read own or admin" on public.audit_events
for select using (owner_id = auth.uid() or public.is_admin());
create policy "audit_events: insert own or admin" on public.audit_events
for insert with check ((owner_id = auth.uid() and actor_id = auth.uid()) or public.is_admin());

-- Generic policies for remaining statement tables
create policy "aggregates_monthly: read own or admin" on public.aggregates_monthly
for select using (owner_id = auth.uid() or public.is_admin());
create policy "aggregates_monthly: insert own or admin" on public.aggregates_monthly
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "pivots: read own or admin" on public.pivots
for select using (owner_id = auth.uid() or public.is_admin());
create policy "pivots: insert own or admin" on public.pivots
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "risk_items: read own or admin" on public.risk_items
for select using (owner_id = auth.uid() or public.is_admin());
create policy "risk_items: insert own or admin" on public.risk_items
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "pinned_evidence: read own or admin" on public.pinned_evidence
for select using (owner_id = auth.uid() or public.is_admin());
create policy "pinned_evidence: insert own or admin" on public.pinned_evidence
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "approvals: read own or admin" on public.approvals
for select using (owner_id = auth.uid() or public.is_admin());
create policy "approvals: insert own or admin" on public.approvals
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "reconciliation_failures: read own or admin" on public.reconciliation_failures
for select using (owner_id = auth.uid() or public.is_admin());
create policy "reconciliation_failures: insert own or admin" on public.reconciliation_failures
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "manual_mapping_sessions: read own or admin" on public.manual_mapping_sessions
for select using (owner_id = auth.uid() or public.is_admin());
create policy "manual_mapping_sessions: insert own or admin" on public.manual_mapping_sessions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "manual_mapping_actions: read own or admin" on public.manual_mapping_actions
for select using (owner_id = auth.uid() or public.is_admin());
create policy "manual_mapping_actions: insert own or admin" on public.manual_mapping_actions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

create policy "collections_calendar: read own or admin" on public.collections_calendar_suggestions
for select using (owner_id = auth.uid() or public.is_admin());
create policy "collections_calendar: insert own or admin" on public.collections_calendar_suggestions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());
