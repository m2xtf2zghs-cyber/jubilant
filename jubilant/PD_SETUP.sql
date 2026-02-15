-- PD (Personal Discussion) + Dynamic Doubts schema
-- Run this AFTER:
-- - jubilant/SUPABASE_SETUP.md (profiles/leads/mediators/is_admin)
-- - jubilant/UNDERWRITING_SETUP.sql (underwriting_applications, etc.)

create extension if not exists "pgcrypto";

-- PD Sessions (1 per underwriting application; can be resumed)
create table if not exists public.pd_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.underwriting_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','closed')),
  open_items_status text not null default 'pending' check (open_items_status in ('resolved','pending','critical'))
);

-- Idempotent add (if table existed before this column was introduced)
alter table public.pd_sessions add column if not exists updated_by uuid references auth.users(id) on delete set null;

create unique index if not exists pd_sessions_app_uniq
on public.pd_sessions (application_id);

create index if not exists pd_sessions_owner_created_at_idx
on public.pd_sessions (owner_id, created_at desc);

-- PD Answers (mandatory PD fields)
create table if not exists public.pd_answers (
  id uuid primary key default gen_random_uuid(),
  pd_session_id uuid not null references public.pd_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  field_key text not null,
  field_label text not null default '',
  value_text text,
  value_number double precision,
  value_json jsonb
);

create unique index if not exists pd_answers_session_key_uniq
on public.pd_answers (pd_session_id, field_key);

-- Generated doubts/questions (deterministic)
create table if not exists public.pd_generated_questions (
  id uuid primary key default gen_random_uuid(),
  pd_session_id uuid not null references public.pd_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,

  -- Stable deterministic code to allow upsert/de-dup per PD session
  code text not null,

  severity text not null default 'Alert' check (severity in ('Alert','High Risk','Immediate Action')),
  category text not null default '',
  question_text text not null,
  answer_type text not null default 'text' check (answer_type in ('text','number','date','yes-no','file','select')),
  options_json jsonb not null default '[]'::jsonb,
  evidence_json jsonb not null default '{}'::jsonb,
  source_rule_id text,
  status text not null default 'Pending' check (status in ('Pending','Resolved','Waived'))
);

create unique index if not exists pd_generated_questions_session_code_uniq
on public.pd_generated_questions (pd_session_id, code);

create index if not exists pd_generated_questions_session_idx
on public.pd_generated_questions (pd_session_id, created_at asc);

-- Generated answers (answers to doubts)
create table if not exists public.pd_generated_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.pd_generated_questions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  answer_text text,
  answer_number double precision,
  answer_json jsonb,
  attachment_path text
);

create unique index if not exists pd_generated_answers_question_uniq
on public.pd_generated_answers (question_id);

-- Attachments (optional evidence uploads)
create table if not exists public.pd_attachments (
  id uuid primary key default gen_random_uuid(),
  pd_session_id uuid not null references public.pd_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  question_id uuid references public.pd_generated_questions(id) on delete set null,
  storage_path text not null,
  file_type text not null default '',
  meta_json jsonb not null default '{}'::jsonb
);

create index if not exists pd_attachments_session_idx
on public.pd_attachments (pd_session_id, created_at desc);

-- Updated-at triggers (reuse function from SUPABASE_SETUP.md if present)
-- If `public.set_updated_at()` already exists, this will just (re)attach triggers.
drop trigger if exists set_pd_sessions_updated_at on public.pd_sessions;
create trigger set_pd_sessions_updated_at
before update on public.pd_sessions
for each row execute procedure public.set_updated_at();

drop trigger if exists set_pd_answers_updated_at on public.pd_answers;
create trigger set_pd_answers_updated_at
before update on public.pd_answers
for each row execute procedure public.set_updated_at();

drop trigger if exists set_pd_generated_questions_updated_at on public.pd_generated_questions;
create trigger set_pd_generated_questions_updated_at
before update on public.pd_generated_questions
for each row execute procedure public.set_updated_at();

drop trigger if exists set_pd_generated_answers_updated_at on public.pd_generated_answers;
create trigger set_pd_generated_answers_updated_at
before update on public.pd_generated_answers
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.pd_sessions enable row level security;
alter table public.pd_answers enable row level security;
alter table public.pd_generated_questions enable row level security;
alter table public.pd_generated_answers enable row level security;
alter table public.pd_attachments enable row level security;

-- pd_sessions policies
drop policy if exists "pd_sessions: read own or admin" on public.pd_sessions;
create policy "pd_sessions: read own or admin" on public.pd_sessions
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_sessions: insert own or admin" on public.pd_sessions;
create policy "pd_sessions: insert own or admin" on public.pd_sessions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "pd_sessions: update own or admin" on public.pd_sessions;
create policy "pd_sessions: update own or admin" on public.pd_sessions
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_sessions: delete own or admin" on public.pd_sessions;
create policy "pd_sessions: delete own or admin" on public.pd_sessions
for delete using (owner_id = auth.uid() or public.is_admin());

-- pd_answers policies
drop policy if exists "pd_answers: read own or admin" on public.pd_answers;
create policy "pd_answers: read own or admin" on public.pd_answers
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_answers: insert own or admin" on public.pd_answers;
create policy "pd_answers: insert own or admin" on public.pd_answers
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "pd_answers: update own or admin" on public.pd_answers;
create policy "pd_answers: update own or admin" on public.pd_answers
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_answers: delete own or admin" on public.pd_answers;
create policy "pd_answers: delete own or admin" on public.pd_answers
for delete using (owner_id = auth.uid() or public.is_admin());

-- pd_generated_questions policies
drop policy if exists "pd_q: read own or admin" on public.pd_generated_questions;
create policy "pd_q: read own or admin" on public.pd_generated_questions
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_q: insert own or admin" on public.pd_generated_questions;
create policy "pd_q: insert own or admin" on public.pd_generated_questions
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "pd_q: update own or admin (waive is admin-only)" on public.pd_generated_questions;
create policy "pd_q: update own or admin (waive is admin-only)" on public.pd_generated_questions
for update using (owner_id = auth.uid() or public.is_admin())
with check (
  (owner_id = auth.uid() or public.is_admin())
  and (public.is_admin() or status <> 'Waived')
);

drop policy if exists "pd_q: delete own or admin" on public.pd_generated_questions;
create policy "pd_q: delete own or admin" on public.pd_generated_questions
for delete using (owner_id = auth.uid() or public.is_admin());

-- pd_generated_answers policies
drop policy if exists "pd_a: read own or admin" on public.pd_generated_answers;
create policy "pd_a: read own or admin" on public.pd_generated_answers
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_a: insert own or admin" on public.pd_generated_answers;
create policy "pd_a: insert own or admin" on public.pd_generated_answers
for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_a: update own or admin" on public.pd_generated_answers;
create policy "pd_a: update own or admin" on public.pd_generated_answers
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_a: delete own or admin" on public.pd_generated_answers;
create policy "pd_a: delete own or admin" on public.pd_generated_answers
for delete using (owner_id = auth.uid() or public.is_admin());

-- pd_attachments policies
drop policy if exists "pd_att: read own or admin" on public.pd_attachments;
create policy "pd_att: read own or admin" on public.pd_attachments
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "pd_att: insert own or admin" on public.pd_attachments;
create policy "pd_att: insert own or admin" on public.pd_attachments
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "pd_att: delete own or admin" on public.pd_attachments;
create policy "pd_att: delete own or admin" on public.pd_attachments
for delete using (owner_id = auth.uid() or public.is_admin());
