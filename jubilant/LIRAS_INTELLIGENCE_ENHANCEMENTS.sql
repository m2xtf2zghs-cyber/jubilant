-- LIRAS additive enhancements (2026-02)
-- Run this after SUPABASE_SETUP.md + UNDERWRITING_SETUP.sql + PD_SETUP.sql + STATEMENT_AUTOPILOT_CORE_SCHEMA.sql.

create extension if not exists "pgcrypto";
create extension if not exists pg_cron;

-- ====================================================
-- 1) Parse lifecycle + strict ledger (no dropped transactions)
-- ====================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'parse_job_status') then
    create type public.parse_job_status as enum ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');
  end if;
end
$$;

alter table public.statement_versions
  add column if not exists parse_status public.parse_job_status not null default 'PENDING',
  add column if not exists error_reason text,
  add column if not exists raw_row_count int not null default 0,
  add column if not exists parsed_row_count int not null default 0,
  add column if not exists parse_started_at timestamptz,
  add column if not exists parse_completed_at timestamptz,
  add column if not exists underwriting_workbook_url text,
  add column if not exists underwriting_workbook_generated_at timestamptz;

create index if not exists statement_versions_parse_status_idx
  on public.statement_versions(parse_status, run_at desc nulls last);

create table if not exists public.statement_transaction_ledger (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements(id) on delete cascade,
  version_id uuid not null references public.statement_versions(id) on delete cascade,
  account_id text,
  txn_id text not null,
  txn_date date not null,
  narration text not null,
  dr numeric(18,2) not null default 0,
  cr numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0,
  balance numeric(18,2),
  raw_row_json jsonb not null default '{}'::jsonb,
  row_index int not null,
  finance_tag text check (finance_tag in ('PVT_FIN', 'BANK_FIN') or finance_tag is null),
  tag_confidence numeric(6,5),
  tag_reason_codes text[] not null default '{}',
  dedupe_hash text not null,
  created_at timestamptz not null default now(),
  unique(version_id, txn_id),
  unique(version_id, dedupe_hash)
);

create index if not exists statement_tx_ledger_statement_idx
  on public.statement_transaction_ledger(statement_id, version_id, txn_date, row_index);

alter table public.transactions
  add column if not exists finance_tag text,
  add column if not exists tag_confidence numeric(6,5),
  add column if not exists tag_reason_codes text[] not null default '{}';

create table if not exists public.statement_underwriting_workbooks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  statement_id uuid not null references public.statements(id) on delete cascade,
  version_id uuid not null references public.statement_versions(id) on delete cascade,
  parse_hash text,
  storage_path text not null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(version_id, parse_hash)
);

-- ====================================================
-- 2) Additive finance-tag config tables (PVT/BANK)
-- ====================================================

create table if not exists public.pvt_fin_entities (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(entity_name)
);

create table if not exists public.bank_fin_entities (
  id uuid primary key default gen_random_uuid(),
  entity_name text not null,
  aliases text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(entity_name)
);

create table if not exists public.finance_keywords (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('PVT', 'BANK')),
  keyword text not null,
  weight numeric(6,3) not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(domain, keyword)
);

create table if not exists public.false_positive_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,
  applies_to text not null default 'ALL' check (applies_to in ('ALL', 'PVT', 'BANK')),
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(pattern, applies_to)
);

create table if not exists public.finance_tag_config (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.finance_tag_config(key, value_json)
values (
  'thresholds',
  jsonb_build_object(
    'pvt_min_score', 2.1,
    'bank_min_score', 2.4,
    'weekly_window_days', 30,
    'weekly_min_hits', 3,
    'same_day_split_min_hits', 2,
    'small_ticket_max', 100000
  )
)
on conflict (key) do nothing;

-- ====================================================
-- 3) Tasks + follow-up automation
-- ====================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('OPEN', 'DONE', 'SKIPPED');
  end if;
end
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  mediator_id uuid references public.mediators(id) on delete cascade,
  task_type text not null,
  status public.task_status not null default 'OPEN',
  title text not null default '',
  due_at timestamptz,
  due_window_end timestamptz,
  dedupe_key text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(dedupe_key)
);

create index if not exists tasks_owner_due_idx
  on public.tasks(owner_id, status, due_at);

create index if not exists tasks_type_due_idx
  on public.tasks(task_type, status, due_at);

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute procedure public.set_updated_at();

create or replace function public.next_business_day_ist(base_ts timestamptz default now())
returns timestamptz
language plpgsql
stable
as $$
declare
  d date;
  dow int;
begin
  d := (base_ts at time zone 'Asia/Kolkata')::date + 1;
  loop
    dow := extract(isodow from d);
    exit when dow between 1 and 5;
    d := d + 1;
  end loop;

  return make_timestamptz(
    extract(year from d)::int,
    extract(month from d)::int,
    extract(day from d)::int,
    10,
    0,
    0,
    'Asia/Kolkata'
  );
end;
$$;

create or replace function public.create_follow_up_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_follow_up boolean := false;
  due_ts timestamptz;
  dedupe text;
  actor uuid;
begin
  if new.status is not null then
    is_follow_up := upper(new.status) in ('FOLLOW UP', 'FOLLOW-UP', 'FOLLOW_UP', 'FOLLOW-UP REQUIRED', 'FOLLOW_UP_REQUIRED', 'FOLLOW-UP REQUIRED', 'PARTNER FOLLOW-UP', 'PARTNER FOLLOW_UP', 'FOLLOW-UP REQUIRED');
    if not is_follow_up then
      is_follow_up := upper(new.status) like '%FOLLOW%';
    end if;
  end if;

  if not is_follow_up then
    return new;
  end if;

  due_ts := public.next_business_day_ist(coalesce(new.next_follow_up, now()));
  actor := coalesce(auth.uid(), new.owner_id);
  dedupe := concat('FOLLOW_UP:', new.id::text, ':', to_char(due_ts at time zone 'Asia/Kolkata', 'YYYY-MM-DD'));

  insert into public.tasks (
    owner_id,
    created_by,
    assigned_to,
    lead_id,
    task_type,
    status,
    title,
    due_at,
    due_window_end,
    dedupe_key,
    payload_json
  )
  values (
    new.owner_id,
    actor,
    coalesce(new.owner_id, actor),
    new.id,
    'FOLLOW_UP',
    'OPEN',
    concat('Follow up: ', coalesce(new.name, 'Lead')),
    due_ts,
    due_ts + interval '8 hours',
    dedupe,
    jsonb_build_object('lead_status', new.status, 'source', 'lead_status_trigger')
  )
  on conflict (dedupe_key) do update
  set
    assigned_to = excluded.assigned_to,
    title = excluded.title,
    due_at = excluded.due_at,
    due_window_end = excluded.due_window_end,
    payload_json = excluded.payload_json,
    status = case when tasks.status = 'DONE' then tasks.status else 'OPEN'::public.task_status end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists leads_follow_up_task_trigger on public.leads;
create trigger leads_follow_up_task_trigger
after insert or update of status, next_follow_up on public.leads
for each row execute procedure public.create_follow_up_task();

create or replace function public.create_daily_mediator_followup_tasks(run_ts timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  due_ts timestamptz;
  due_end timestamptz;
  local_date text;
  inserted_count int := 0;
begin
  due_ts := make_timestamptz(
    extract(year from (run_ts at time zone 'Asia/Kolkata'))::int,
    extract(month from (run_ts at time zone 'Asia/Kolkata'))::int,
    extract(day from (run_ts at time zone 'Asia/Kolkata'))::int,
    10,
    0,
    0,
    'Asia/Kolkata'
  );
  due_end := make_timestamptz(
    extract(year from (run_ts at time zone 'Asia/Kolkata'))::int,
    extract(month from (run_ts at time zone 'Asia/Kolkata'))::int,
    extract(day from (run_ts at time zone 'Asia/Kolkata'))::int,
    12,
    0,
    0,
    'Asia/Kolkata'
  );
  local_date := to_char(run_ts at time zone 'Asia/Kolkata', 'YYYY-MM-DD');

  with ins as (
    insert into public.tasks (
      owner_id,
      created_by,
      assigned_to,
      mediator_id,
      task_type,
      status,
      title,
      due_at,
      due_window_end,
      dedupe_key,
      payload_json
    )
    select
      m.owner_id,
      m.owner_id,
      m.owner_id,
      m.id,
      'MEDIATOR_FOLLOW_UP',
      'OPEN',
      concat('Daily mediator follow-up: ', m.name),
      due_ts,
      due_end,
      concat('MEDIATOR_FOLLOW_UP:', m.id::text, ':', local_date),
      jsonb_build_object('mediators_phone', coalesce(m.phone, ''), 'source', 'daily_cron')
    from public.mediators m
    where coalesce(m.name, '') <> ''
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*) into inserted_count from ins;

  return inserted_count;
end;
$$;

-- Optional cron schedule (09:55 IST every day)
-- select cron.schedule(
--   'daily_mediator_followup_0955_ist',
--   '25 4 * * *',
--   $$select public.create_daily_mediator_followup_tasks(now());$$
-- );

-- ====================================================
-- 4) Renewal watch + report health
-- ====================================================

create or replace view public.renewal_watch_timeline as
select
  l.id as lead_id,
  l.owner_id,
  l.name,
  l.status,
  l.loan_amount,
  l.loan_details,
  case
    when nullif(l.loan_details->>'nextRenewalDate', '') is not null then (l.loan_details->>'nextRenewalDate')::date
    when nullif(l.loan_details->>'maturityDate', '') is not null then (l.loan_details->>'maturityDate')::date
    when nullif(l.loan_details->>'fundedDate', '') is not null and nullif(l.loan_details->>'tenure', '') is not null then
      ((l.loan_details->>'fundedDate')::date + make_interval(months => greatest(0, (l.loan_details->>'tenure')::int)))::date
    else null
  end as renewal_date,
  case
    when nullif(l.loan_details->>'nextRenewalDate', '') is not null then 'next_renewal_date'
    when nullif(l.loan_details->>'maturityDate', '') is not null then 'maturity_date'
    when nullif(l.loan_details->>'fundedDate', '') is not null and nullif(l.loan_details->>'tenure', '') is not null then 'funded_plus_tenor'
    else 'unknown'
  end as source_priority,
  case
    when nullif(l.loan_details->>'nextRenewalDate', '') is not null then 1
    when nullif(l.loan_details->>'maturityDate', '') is not null then 2
    when nullif(l.loan_details->>'fundedDate', '') is not null and nullif(l.loan_details->>'tenure', '') is not null then 3
    else 4
  end as priority_rank
from public.leads l
where upper(coalesce(l.status, '')) in ('PAYMENT DONE', 'DEAL CLOSED', 'FUNDED', 'ACTIVE');

create table if not exists public.report_health_checks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  report_type text not null check (report_type in ('DAILY_ACTIVITY', 'EOD')),
  row_count int not null default 0,
  totals_checksum text not null default '',
  status text not null check (status in ('SUCCESS', 'FAILED')),
  activity_count int not null default 0,
  meta_json jsonb not null default '{}'::jsonb,
  regenerated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id, report_date, report_type)
);

create index if not exists report_health_checks_owner_date_idx
  on public.report_health_checks(owner_id, report_date desc, report_type);

-- ====================================================
-- 5) Push tokens for Android FCM
-- ====================================================

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ANDROID',
  token text not null,
  device_id text,
  app_build text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, token)
);

create index if not exists user_push_tokens_user_active_idx
  on public.user_push_tokens(user_id, is_active, last_seen_at desc);

create trigger set_user_push_tokens_updated_at
before update on public.user_push_tokens
for each row execute procedure public.set_updated_at();

-- ====================================================
-- 6) RLS
-- ====================================================

alter table public.statement_transaction_ledger enable row level security;
alter table public.statement_underwriting_workbooks enable row level security;
alter table public.tasks enable row level security;
alter table public.report_health_checks enable row level security;
alter table public.user_push_tokens enable row level security;

-- Statement transaction ledger

drop policy if exists "stmt_ledger: read own or admin" on public.statement_transaction_ledger;
create policy "stmt_ledger: read own or admin" on public.statement_transaction_ledger
for select using (
  exists (
    select 1
    from public.statement_versions v
    join public.statements s on s.id = v.statement_id
    where v.id = statement_transaction_ledger.version_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
);

drop policy if exists "stmt_ledger: insert own or admin" on public.statement_transaction_ledger;
create policy "stmt_ledger: insert own or admin" on public.statement_transaction_ledger
for insert with check (
  exists (
    select 1
    from public.statement_versions v
    join public.statements s on s.id = v.statement_id
    where v.id = statement_transaction_ledger.version_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
);

-- Workbook rows

drop policy if exists "stmt_wb: read own or admin" on public.statement_underwriting_workbooks;
create policy "stmt_wb: read own or admin" on public.statement_underwriting_workbooks
for select using (
  exists (
    select 1
    from public.statements s
    where s.id = statement_underwriting_workbooks.statement_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
);

drop policy if exists "stmt_wb: insert own or admin" on public.statement_underwriting_workbooks;
create policy "stmt_wb: insert own or admin" on public.statement_underwriting_workbooks
for insert with check (
  exists (
    select 1
    from public.statements s
    where s.id = statement_underwriting_workbooks.statement_id
      and (s.created_by = auth.uid() or public.is_admin())
  )
);

-- Tasks

drop policy if exists "tasks: read own or admin" on public.tasks;
create policy "tasks: read own or admin" on public.tasks
for select using (owner_id = auth.uid() or assigned_to = auth.uid() or public.is_admin());

drop policy if exists "tasks: insert own or admin" on public.tasks;
create policy "tasks: insert own or admin" on public.tasks
for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "tasks: update own or admin" on public.tasks;
create policy "tasks: update own or admin" on public.tasks
for update using (owner_id = auth.uid() or assigned_to = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or assigned_to = auth.uid() or public.is_admin());

-- Report health

drop policy if exists "report_health: read own or admin" on public.report_health_checks;
create policy "report_health: read own or admin" on public.report_health_checks
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "report_health: upsert own or admin" on public.report_health_checks;
create policy "report_health: upsert own or admin" on public.report_health_checks
for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "report_health: update own or admin" on public.report_health_checks;
create policy "report_health: update own or admin" on public.report_health_checks
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

-- Push tokens

drop policy if exists "push_tokens: read own or admin" on public.user_push_tokens;
create policy "push_tokens: read own or admin" on public.user_push_tokens
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "push_tokens: insert own or admin" on public.user_push_tokens;
create policy "push_tokens: insert own or admin" on public.user_push_tokens
for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "push_tokens: update own or admin" on public.user_push_tokens;
create policy "push_tokens: update own or admin" on public.user_push_tokens
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
