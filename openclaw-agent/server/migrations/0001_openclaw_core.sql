create table if not exists openclaw_app_state (
  workspace text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists dsa_contacts (
  id text primary key,
  name text not null,
  phone text,
  city text,
  source text,
  loan_types jsonb not null default '[]'::jsonb,
  tag text,
  segment text,
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  last_reply_at timestamptz,
  total_messages integer not null default 0,
  reply_count integer not null default 0,
  leads_referred integer not null default 0,
  converted_count integer not null default 0,
  commission_earned numeric(14,2) not null default 0,
  engagement_level text,
  preferred_language text,
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id text primary key,
  name text not null,
  segment text,
  status text,
  template text,
  daily_limit integer,
  send_window text,
  random_delay_range text,
  started_at timestamptz,
  sender_pool integer,
  today_sent integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id text primary key,
  name text not null,
  phone text,
  city text,
  loan_type text,
  amount numeric(14,2) not null default 0,
  employment_type text,
  employer text,
  source_dsa_id text references dsa_contacts(id) on delete set null,
  stage text,
  created_at timestamptz,
  next_action text,
  days_in_stage integer not null default 0,
  missing_documents jsonb not null default '[]'::jsonb,
  status_note text,
  updated_at timestamptz not null default now()
);

create table if not exists borrowers (
  id text primary key,
  name text not null,
  phone text,
  city text,
  loan_amount numeric(14,2) not null default 0,
  emi numeric(14,2) not null default 0,
  outstanding numeric(14,2) not null default 0,
  days_past_due integer not null default 0,
  due_date text,
  payment_history jsonb not null default '[]'::jsonb,
  assigned_mediator_id text,
  tag text,
  ptp jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists mediators (
  id text primary key,
  name text not null,
  phone text,
  type text,
  area text,
  status text,
  commission_rule text,
  onboarding_date timestamptz,
  agreement_status text,
  tasks_assigned integer not null default 0,
  tasks_completed integer not null default 0,
  recovery_amount numeric(14,2) not null default 0,
  documents_collected integer not null default 0,
  avg_response_minutes integer not null default 0,
  ptp_won integer not null default 0,
  ptp_fulfilled integer not null default 0,
  commission_earned numeric(14,2) not null default 0,
  last_reported_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists mediator_tasks (
  id text primary key,
  mediator_id text references mediators(id) on delete cascade,
  title text not null,
  type text,
  priority text,
  due_at timestamptz,
  status text,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id text primary key,
  contact_type text not null,
  contact_id text not null,
  contact_name text not null,
  channel text,
  priority text,
  unread_count integer not null default 0,
  last_message_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  direction text not null,
  at timestamptz not null,
  text text not null,
  intent text,
  handled_by text,
  pending boolean not null default false
);

create table if not exists activity_feed (
  id text primary key,
  at timestamptz not null,
  lane text not null,
  text text not null
);

create table if not exists scheduled_reports (
  id text primary key,
  name text not null,
  cadence text,
  destination text,
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  singleton boolean primary key default true,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (singleton)
);

create table if not exists inbound_webhook_events (
  id bigserial primary key,
  channel text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists idx_dsa_contacts_city on dsa_contacts(city);
create index if not exists idx_leads_stage on leads(stage);
create index if not exists idx_borrowers_dpd on borrowers(days_past_due);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_activity_feed_at on activity_feed(at desc);
