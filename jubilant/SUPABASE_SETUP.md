# Supabase Backend Setup (Admin + Staff, Invite-only)

This app can run in **local-only** mode (no login, data in `localStorage`) or in **backend** mode (multi-user) powered by Supabase.

Backend mode is enabled automatically when these env vars exist at build time:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 1) Create Supabase project

1. Create a new Supabase project.
2. Note the **Project URL** and the **Anon public key**.

## 2) Configure Auth (invite-only)

In Supabase Dashboard → **Authentication**:

- Disable public signups (invite-only / no self sign-up).
- Ensure Email/Password sign-in is enabled.

Create users in **Auth → Users** (Add/Invite users).

Optional (recommended): in-app user creation/invites

If you want to create/invite staff users from inside the app (admin-only), set a **server-only** env var on Netlify:

- `SUPABASE_SERVICE_ROLE_KEY` (Supabase project settings → API → `service_role` key)

This is used only by the Netlify Function `/.netlify/functions/admin-users` and must **never** be exposed in `VITE_*` client env vars.

## 3) Create tables + RLS policies

Open Supabase Dashboard → **SQL Editor** and run the SQL below.

> This SQL enforces: staff can only see/edit their own leads & mediators; admin can see everything.

```sql
-- Enable UUID generation (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- Profiles: stores role + email for UI assignment dropdowns
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'staff')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper to check admin role
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

-- Ensure logged-in users can execute the helper in RLS policies
grant execute on function public.is_admin() to authenticated;

-- Mediators (private per staff via owner_id)
create table if not exists public.mediators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  phone text not null default '',
  follow_up_history jsonb not null default '[]'::jsonb
);

create unique index if not exists mediators_owner_name_phone_idx
on public.mediators (owner_id, name, phone);

-- Leads (private per staff via owner_id)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  phone text,
  company text,
  location text,
  status text not null default 'New',
  loan_amount bigint not null default 0,
  next_follow_up timestamptz,
  mediator_id uuid references public.mediators(id) on delete set null,
  is_high_potential boolean not null default false,
  assigned_staff text,
  documents jsonb not null default '{"kyc": false, "itr": false, "bank": false}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  loan_details jsonb,
  rejection_details jsonb
);

-- Auto-updated timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_mediators_updated_at on public.mediators;
create trigger set_mediators_updated_at
before update on public.mediators
for each row execute procedure public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

-- Enforce that a lead can only reference a mediator owned by the same owner (unless admin)
create or replace function public.enforce_lead_mediator_owner()
returns trigger
language plpgsql
as $$
declare
  mediator_owner uuid;
begin
  if new.mediator_id is null then
    return new;
  end if;

  select owner_id into mediator_owner from public.mediators where id = new.mediator_id;
  if mediator_owner is null then
    new.mediator_id = null;
    return new;
  end if;

  if mediator_owner <> new.owner_id and not public.is_admin() then
    raise exception 'Mediator must belong to the lead owner';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_lead_mediator_owner on public.leads;
create trigger enforce_lead_mediator_owner
before insert or update of mediator_id, owner_id on public.leads
for each row execute procedure public.enforce_lead_mediator_owner();

-- RLS
alter table public.profiles enable row level security;
alter table public.mediators enable row level security;
alter table public.leads enable row level security;

-- Profiles policies
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
for select using (auth.uid() = user_id);

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all" on public.profiles
for select using (public.is_admin());

drop policy if exists "profiles: admin update" on public.profiles;
create policy "profiles: admin update" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

-- Mediators policies
drop policy if exists "mediators: read own or admin" on public.mediators;
create policy "mediators: read own or admin" on public.mediators
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "mediators: insert own or admin" on public.mediators;
create policy "mediators: insert own or admin" on public.mediators
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "mediators: update own or admin" on public.mediators;
create policy "mediators: update own or admin" on public.mediators
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "mediators: delete own or admin" on public.mediators;
create policy "mediators: delete own or admin" on public.mediators
for delete using (owner_id = auth.uid() or public.is_admin());

-- Leads policies
drop policy if exists "leads: read own or admin" on public.leads;
create policy "leads: read own or admin" on public.leads
for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "leads: insert own or admin" on public.leads;
create policy "leads: insert own or admin" on public.leads
for insert with check ((owner_id = auth.uid() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "leads: update own or admin" on public.leads;
create policy "leads: update own or admin" on public.leads
for update using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "leads: delete own or admin" on public.leads;
create policy "leads: delete own or admin" on public.leads
for delete using (owner_id = auth.uid() or public.is_admin());
```

## 4) Statement Autopilot schema

Run the Statement Autopilot schema after the core tables:

- `jubilant/STATEMENT_AUTOPILOT_SETUP.sql`

This adds:
- statement tables + strict reconciliation tables
- `bank_parsing_templates` registry (admin template builder)
- manual mapping + audit tables

## 4) Underwriting (Hardcoded Rule Engine)

For the new **Hardcoded Underwriting (Rule Engine + Credit & Recovery Intelligence)** feature, run:

- `jubilant/UNDERWRITING_SETUP.sql`

This creates:

- `underwriting_applications`

## 5) Statement Autopilot (Strict Reconciliation)

For the new **Statement Autopilot** pipeline, run:

- `jubilant/STATEMENT_AUTOPILOT_SETUP.sql`

This creates:

- `statements`, `statement_versions`, `raw_statement_lines`, `transactions`
- Supporting tables for pivots, risk items, approvals, audit, and manual mapping
- `underwriting_documents`
- `underwriting_transactions`
- `underwriting_metrics`
- `underwriting_rule_runs`
- `underwriting_flags`
- `underwriting_recommendations`
- `underwriting_triggers`

RLS follows the same pattern as `leads`/`mediators`:

- Staff: rows where `owner_id = auth.uid()`
- Admin: all rows via `public.is_admin()`

## 5) PD (Personal Discussion) + Dynamic Doubts

For the **PD + Dynamic Doubts** workflow (Underwriting → PD), run:

- `jubilant/PD_SETUP.sql`

This creates:

- `pd_sessions`
- `pd_answers`
- `pd_generated_questions`
- `pd_generated_answers`
- `pd_attachments`

RLS follows the same pattern:

- Staff: rows where `owner_id = auth.uid()`
- Admin: all rows via `public.is_admin()`
- Waive is admin-only via `pd_generated_questions.status = 'Waived'`

## 4) Make yourself the initial admin

1. Create your first user in Supabase Auth (Users → Add user).
2. In SQL Editor, run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL_HERE';
```

## 5) Configure env vars (Netlify + local + mobile)

### Netlify (website)

In Netlify site settings → Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional, only needed for in-app admin “Add Staff Account”)

Redeploy.

### Local / Mobile (Capacitor)

Create `jubilant/.env` (based on `jubilant/.env.example`) and rebuild:

```bash
cd jubilant
npm install
npm run build
npx cap copy
```

## 6) (Optional) Enable AI tools (Gemini) safely

AI calls must run **server-side** (to keep your API key private). This repo includes a Netlify Function at:

- `jubilant/netlify/functions/ai.mjs`

**Access control:** AI tools are available to any signed-in user. Your Supabase RLS policies still ensure staff can only access their own/assigned leads and mediators.

### Netlify (website + API)

In Netlify site settings → **Environment variables**, set:

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional, default: `gemini-2.0-flash`)

Then redeploy.

### Mobile (Capacitor APK/IPA)

Mobile builds load the app from local assets, so they must call the AI function via a full URL.

Add to `jubilant/.env`:

- `VITE_FUNCTIONS_BASE_URL="https://YOUR_NETLIFY_SITE.netlify.app"` (recommended)
  - (Backward compatible) `VITE_AI_BASE_URL` also works, but `VITE_FUNCTIONS_BASE_URL` is clearer since it’s used for both AI + admin tools.

Then rebuild + sync (`npm run build && npm run cap:sync`) and regenerate your APK/AAB.

## 7) (Optional) Enable secure file attachments (KYC/ITR/Bank)

Leads can store attachment *metadata* in the `documents` JSON field. Actual files should be stored in **Supabase Storage**.

### Create a private bucket

Supabase Dashboard → **Storage** → **New bucket**

- Name: `liras-attachments`
- Public: **OFF** (recommended)

### Add Storage policies (owner-folder + admin access)

In SQL Editor, run:

```sql
-- Read: staff can read their own folder; admin can read all
drop policy if exists "attachments: read own or admin" on storage.objects;
create policy "attachments: read own or admin" on storage.objects
for select
using (
  bucket_id = 'liras-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- Write: staff can upload only to their own folder; admin can upload anywhere
drop policy if exists "attachments: write own or admin" on storage.objects;
create policy "attachments: write own or admin" on storage.objects
for insert
with check (
  bucket_id = 'liras-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- Delete: staff can delete from their own folder; admin can delete all
drop policy if exists "attachments: delete own or admin" on storage.objects;
create policy "attachments: delete own or admin" on storage.objects
for delete
using (
  bucket_id = 'liras-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
```

Notes:
- The app stores files under: `<owner_id>/<lead_id>/<file_id>-<filename>`
- If upload fails, the attachment stays **local on the device** (IndexedDB) and can be uploaded later.
- Underwriting PDFs are stored under: `<owner_id>/underwriting/<application_id>/<timestamp>_<filename>`
- PD evidence uploads are stored under: `<owner_id>/pd/<pd_session_id>/<question_id>/<timestamp>_<filename>`

## 8) (Optional) Enable in-app announcements (admin banner)

This enables the **Admin: Announcements** panel in the app settings and shows a dismissible banner to staff.

Run in Supabase SQL Editor:

```sql
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','success','warning','danger')),
  audience_role text not null default 'all' check (audience_role in ('all','staff','admin')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true
);

alter table public.announcements enable row level security;

drop policy if exists "announcements: read" on public.announcements;
create policy "announcements: read" on public.announcements
for select using (auth.role() = 'authenticated');

drop policy if exists "announcements: admin insert" on public.announcements;
create policy "announcements: admin insert" on public.announcements
for insert with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "announcements: admin update" on public.announcements;
create policy "announcements: admin update" on public.announcements
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "announcements: admin delete" on public.announcements;
create policy "announcements: admin delete" on public.announcements
for delete using (public.is_admin());
```

## 4) Storage bucket (required)

Create a **private** storage bucket named `liras-attachments`.

This bucket is used for:
- Lead attachments
- PD attachments
- Underwriting docs
- Statement Autopilot PDF uploads

Supabase Dashboard → **Storage** → **Create bucket**:
- Name: `liras-attachments`
- Public: **Off**

If you see “Bucket not found” errors in the app, this bucket is missing.
