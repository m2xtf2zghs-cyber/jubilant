-- Underwriting (Hardcoded Rule Engine) schema
-- Run this AFTER the base setup in SUPABASE_SETUP.md (profiles/leads/mediators/is_admin).

create extension if not exists "pgcrypto";

-- Applications (one underwriting run per lead/account/period)
create table if not exists public.underwriting_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'completed',
  period_start date,
  period_end date,
  bank_name text not null default '',
  account_type text not null default '',
  requested_exposure bigint not null default 0,
  report_json jsonb not null default '{}'::jsonb,
  aggressive_summary text not null default ''
);

create index if not exists underwriting_applications_owner_created_at_idx
on public.underwriting_applications (owner_id, created_at desc);

create index if not exists underwriting_applications_lead_created_at_idx
on public.underwriting_applications (lead_id, created_at desc);

-- Documents uploaded (bank PDFs now; GST/ITR later)
create table if not exists public.underwriting_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  type text not null check (type in ('BANK_PDF','GST','ITR')),
  storage_path text not null,
  meta_json jsonb not null default '{}'::jsonb
);

create index if not exists underwriting_documents_app_idx
on public.underwriting_documents (application_id, created_at desc);

-- Normalized transactions (optional but recommended for audit)
create table if not exists public.underwriting_transactions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  tx_date date not null,
  narration text not null,
  debit bigint not null default 0,
  credit bigint not null default 0,
  balance bigint
);

create index if not exists underwriting_transactions_app_date_idx
on public.underwriting_transactions (application_id, tx_date asc);

-- Metrics (computed aggregates)
create table if not exists public.underwriting_metrics (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  key text not null,
  value_numeric double precision not null default 0,
  unit text not null default '',
  period text not null default '',
  meta_json jsonb not null default '{}'::jsonb
);

create unique index if not exists underwriting_metrics_app_key_uniq
on public.underwriting_metrics (application_id, key);

-- Rule run log (explainable deterministic underwriting)
create table if not exists public.underwriting_rule_runs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  rule_id text not null,
  result boolean not null,
  severity text not null default 'Medium',
  score_delta int not null default 0,
  evidence_json jsonb not null default '{}'::jsonb
);

create index if not exists underwriting_rule_runs_app_idx
on public.underwriting_rule_runs (application_id, created_at asc);

-- Flags (derived outcomes)
create table if not exists public.underwriting_flags (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  code text not null,
  severity text not null default 'Medium',
  description text not null default '',
  evidence_json jsonb not null default '{}'::jsonb
);

create index if not exists underwriting_flags_app_idx
on public.underwriting_flags (application_id, created_at asc);

-- Recommendation (structure + pricing)
create table if not exists public.underwriting_recommendations (
  application_id uuid primary key references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  recommended_exposure bigint not null default 0,
  tenure_months int not null default 0,
  collection_freq text not null default 'Monthly',
  collection_amt bigint not null default 0,
  upfront_deduction_pct double precision not null default 0,
  upfront_deduction_amt bigint not null default 0,
  pricing_apr double precision not null default 0,
  structure_json jsonb not null default '{}'::jsonb
);

-- Triggers (early warning system)
create table if not exists public.underwriting_triggers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  trigger_type text not null,
  severity text not null default 'Medium',
  condition_json jsonb not null default '{}'::jsonb,
  description text not null default ''
);

create index if not exists underwriting_triggers_app_idx
on public.underwriting_triggers (application_id, created_at asc);

-- Idempotent add (if tables existed before audit columns were introduced)
alter table public.underwriting_transactions add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.underwriting_metrics add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.underwriting_rule_runs add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.underwriting_flags add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.underwriting_recommendations add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.underwriting_recommendations add column if not exists updated_at timestamptz not null default now();
alter table public.underwriting_recommendations add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.underwriting_triggers add column if not exists created_by uuid references auth.users(id) on delete restrict;

-- Updated timestamps
drop trigger if exists set_underwriting_applications_updated_at on public.underwriting_applications;
create trigger set_underwriting_applications_updated_at
before update on public.underwriting_applications
for each row execute procedure public.set_updated_at();

drop trigger if exists set_underwriting_recommendations_updated_at on public.underwriting_recommendations;
create trigger set_underwriting_recommendations_updated_at
before update on public.underwriting_recommendations
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.underwriting_applications enable row level security;
alter table public.underwriting_documents enable row level security;
alter table public.underwriting_transactions enable row level security;
alter table public.underwriting_metrics enable row level security;
alter table public.underwriting_rule_runs enable row level security;
alter table public.underwriting_flags enable row level security;
alter table public.underwriting_recommendations enable row level security;
alter table public.underwriting_triggers enable row level security;

-- Applications policies
drop policy if exists "uw_app: read own or admin" on public.underwriting_applications;
create policy "uw_app: read own or admin" on public.underwriting_applications
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_app: insert own or admin" on public.underwriting_applications;
create policy "uw_app: insert own or admin" on public.underwriting_applications
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_app: update own or admin" on public.underwriting_applications;
create policy "uw_app: update own or admin" on public.underwriting_applications
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_app: delete own or admin" on public.underwriting_applications;
create policy "uw_app: delete own or admin" on public.underwriting_applications
for delete using (owner_id = auth.uid() or public.is_admin());

-- Child tables policies helper (repeat pattern)
-- Documents
drop policy if exists "uw_docs: read own or admin" on public.underwriting_documents;
create policy "uw_docs: read own or admin" on public.underwriting_documents
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_docs: insert own or admin" on public.underwriting_documents;
create policy "uw_docs: insert own or admin" on public.underwriting_documents
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_docs: delete own or admin" on public.underwriting_documents;
create policy "uw_docs: delete own or admin" on public.underwriting_documents
for delete using (owner_id = auth.uid() or public.is_admin());

-- Transactions
drop policy if exists "uw_tx: read own or admin" on public.underwriting_transactions;
create policy "uw_tx: read own or admin" on public.underwriting_transactions
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_tx: insert own or admin" on public.underwriting_transactions;
create policy "uw_tx: insert own or admin" on public.underwriting_transactions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_tx: delete own or admin" on public.underwriting_transactions;
create policy "uw_tx: delete own or admin" on public.underwriting_transactions
for delete using (owner_id = auth.uid() or public.is_admin());

-- Metrics
drop policy if exists "uw_metrics: read own or admin" on public.underwriting_metrics;
create policy "uw_metrics: read own or admin" on public.underwriting_metrics
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_metrics: insert own or admin" on public.underwriting_metrics;
create policy "uw_metrics: insert own or admin" on public.underwriting_metrics
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_metrics: delete own or admin" on public.underwriting_metrics;
create policy "uw_metrics: delete own or admin" on public.underwriting_metrics
for delete using (owner_id = auth.uid() or public.is_admin());

-- Rule runs
drop policy if exists "uw_rules: read own or admin" on public.underwriting_rule_runs;
create policy "uw_rules: read own or admin" on public.underwriting_rule_runs
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_rules: insert own or admin" on public.underwriting_rule_runs;
create policy "uw_rules: insert own or admin" on public.underwriting_rule_runs
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_rules: delete own or admin" on public.underwriting_rule_runs;
create policy "uw_rules: delete own or admin" on public.underwriting_rule_runs
for delete using (owner_id = auth.uid() or public.is_admin());

-- Flags
drop policy if exists "uw_flags: read own or admin" on public.underwriting_flags;
create policy "uw_flags: read own or admin" on public.underwriting_flags
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_flags: insert own or admin" on public.underwriting_flags;
create policy "uw_flags: insert own or admin" on public.underwriting_flags
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_flags: delete own or admin" on public.underwriting_flags;
create policy "uw_flags: delete own or admin" on public.underwriting_flags
for delete using (owner_id = auth.uid() or public.is_admin());

-- Recommendations
drop policy if exists "uw_rec: read own or admin" on public.underwriting_recommendations;
create policy "uw_rec: read own or admin" on public.underwriting_recommendations
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_rec: upsert own or admin" on public.underwriting_recommendations;
create policy "uw_rec: upsert own or admin" on public.underwriting_recommendations
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_rec: update own or admin" on public.underwriting_recommendations;
create policy "uw_rec: update own or admin" on public.underwriting_recommendations
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

-- Triggers
drop policy if exists "uw_trig: read own or admin" on public.underwriting_triggers;
create policy "uw_trig: read own or admin" on public.underwriting_triggers
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "uw_trig: insert own or admin" on public.underwriting_triggers;
create policy "uw_trig: insert own or admin" on public.underwriting_triggers
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "uw_trig: delete own or admin" on public.underwriting_triggers;
create policy "uw_trig: delete own or admin" on public.underwriting_triggers
for delete using (owner_id = auth.uid() or public.is_admin());
