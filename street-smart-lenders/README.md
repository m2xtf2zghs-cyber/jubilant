# Street Smart Lenders

A full-stack private lending operations platform built for NBFCs and private lenders in India.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui components + Tailwind CSS + Lucide icons
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod

## Quick Start

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project.

### 2. Run the database schema

In the Supabase SQL Editor, paste and run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, RLS policies, triggers, sequences, and storage buckets.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Find these in: Supabase → Project Settings → API.

### 4. Create first admin user

In Supabase → Authentication → Users → Invite User (or use email signup).

Then in the SQL Editor:
```sql
INSERT INTO user_profiles (id, email, full_name, role)
VALUES (
  '<your-auth-user-id>',
  'admin@yourcompany.com',
  'Admin User',
  'ADMIN'
);
```

### 5. Run the app

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Phase 1 MVP — What's built

| Module | Features |
|--------|---------|
| **Authentication** | Email/password login, role-based access |
| **Dashboard** | KPI cards (AUM, disbursements, collections, overdue), disbursement trend chart, DPD distribution pie, recent leads, overdue accounts |
| **Leads** | Full pipeline (NEW → DISBURSED), mobile/PAN duplicate detection, DSA tagging, follow-up scheduling, communication log |
| **Borrowers** | KYC vault with 13 document categories, upload to Supabase Storage, CIBIL tracking, business profile |
| **Loans** | Loan creation with auto repayment schedule generation, EMI calculator, disbursement recording, full loan detail with schedule + payment history |
| **Collections** | Daily dues list, overdue tracker, PTP tracker, one-tap Call/WhatsApp, payment marking (PAID/PARTIAL/NOT_PAID/PTP/DISPUTE) |
| **DSAs** | Master list, performance stats (leads, loans, business volume, commission pending), commission auto-calculation |
| **Settings** | Company profile, user role management, dark/light mode |

---

## Database Schema

Key tables:
- `borrowers` — KYC and profile data
- `leads` — enquiry pipeline with status tracking
- `loans` — loan book with full terms
- `repayment_schedule` — auto-generated instalment schedule
- `payments` — payment event log with DPD calculation
- `documents` — file metadata linked to Supabase Storage
- `dsas` — mediator/DSA master data
- `dsa_commissions` — commission ledger
- `field_visits` — site visit reports with GPS
- `communication_log` — call/WhatsApp/email notes
- `alerts` — system and manual alerts
- `user_profiles` — roles and access
- `company_settings` — org config

All tables have Row Level Security (RLS) enabled.
Realtime subscriptions on `payments` and `leads` for live dashboard updates.

---

## Indian Formatting

- All amounts use `₹` symbol with Indian comma format (e.g., ₹12,50,000)
- Amounts above ₹1L shown as "₹X.XX L", above ₹1Cr as "₹X.XX Cr"
- All dates in DD-MMM-YYYY format (e.g., 10-Apr-2026)
- DPD color coding: Green (0), Yellow (1-30), Orange (31-60), Red (61-90), Dark Red (90+)

---

## Phase 2 (Planned)

- Credit Analysis Workbench (bank statement parser, DSCR, FOIR, credit scorecard, memo PDF)
- Interest accrual ledger and P&L
- DSA commission statements
- Field visit GPS + photo upload
- Alerts and WhatsApp reminder templates
- Full reports module (MIS, overdue aging, cash flow projection)
- Cheque management and Section 138 tracker
