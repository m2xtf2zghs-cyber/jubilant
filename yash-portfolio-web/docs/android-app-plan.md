# Android App Screen Flow and Offline Sync Plan

## Product Goal
Enable field collections, client lookup, and follow-up operations with unreliable internet while preserving accounting integrity and auditability.

## User Roles (Android)
- `COLLECTION_AGENT`: Due lists, client profile, collection entry, reminders/calls
- `ACCOUNTS_OFFICER`: All agent flows + expenses, reports, manual controls
- `OWNER/AUDITOR`: Read-only dashboards, reports, audit logs (optional mobile)

## Screen Flow (Android)

### 1. App Launch
- Splash / version check
- Session restore
- If token expired: refresh token
- If no session: Login

### 2. Login & Device Registration
- Email/password login
- Device naming (first login only)
- Sync bootstrap (download master data + due schedules)

### 3. Home Dashboard (role-aware)
- KPI cards: Cash, Receivables, Overdue, PAR30, Today Due
- Quick actions:
  - Collect Payment
  - Clients
  - Alerts
  - Expenses (accounts only)
  - Sync Status

### 4. Alerts / Due List
Tabs:
- Due Today
- Overdue
- Next 7 Days

Row actions:
- Open client
- Call (phone dial intent)
- Copy reminder text / WhatsApp share
- Collect

### 5. Client Search / Client Detail
Client Detail sections:
- Profile (phone, KYC, address, risk grade, notes)
- Active loans
- Closed loans
- Collection history timeline
- Follow-up/reminder history

Actions:
- Edit profile (permissions)
- Add reminder note
- Start collection

### 6. Loan Detail
- Loan summary (principal, interest, total, progress)
- Schedule list (installment chips/cards)
- Installment status timeline
- Notes/purpose/agent assignment

Actions:
- Collect against selected installment
- Close loan (restricted)
- View audit trail (restricted)

### 7. Collection Entry (Critical Transaction Flow)
Fields:
- Loan / installment (preselected)
- Amount
- Full / Partial / Write-off
- Payment mode
- Notes
- Receipt no. (optional)
- Timestamp (auto, editable with permission)

Validation:
- Amount > 0 (except write-off)
- Cannot exceed outstanding unless explicit over-collection policy
- Idempotency key generated client-side

On save:
- If online: submit immediately and commit local copy after success
- If offline: queue to local outbox + mark as “Pending Sync”

### 8. Expenses (Accounts Officer)
- List + filters (date/category)
- Add expense form
- Pending sync badges

### 9. Reports (Mobile Lite)
- Summary dashboard
- Day book (date picker)
- Aging summary
- Collection efficiency (monthly)

### 10. Sync Center
- Last sync time
- Pending uploads count
- Failed sync items with retry
- Conflict queue / review actions
- Manual sync button

### 11. Settings
- Logout
- Device info
- App version
- Download diagnostics (optional)

## Navigation Structure (Recommended)
Bottom navigation:
- Home
- Alerts
- Clients
- Sync
- More

Nested stack per tab for details/forms.

## Offline Data Model (Android local DB)
Use Room (SQLite) with these core tables:
- `client_entities`
- `loan_entities`
- `installment_entities`
- `collection_entities`
- `expense_entities`
- `ledger_preview_entities` (optional, for mobile report views)
- `outbox_events`
- `sync_state`
- `conflicts`

Each synced entity should include:
- `id`
- `serverVersion`
- `updatedAt`
- `isDirty`
- `isDeleted` (soft-delete sync compatibility)
- `lastSyncedAt`

## Sync Strategy (Offline-First)

### Push-then-Pull Cycle (recommended)
1. Push local outbox events in creation order
2. Server processes atomically and returns accepted/rejected events
3. Pull all server changes since last cursor
4. Apply changes to local DB in a transaction
5. Update sync cursor + clear/mark outbox events

### Why event-based push + state-based pull
- Pushing events preserves user intent (e.g., collection against installment)
- Pulling normalized entities keeps device state consistent after server recalculations

## Conflict Handling Rules

### Collections (financial writes)
- Prefer **server authority**
- Use `Idempotency-Key` to prevent duplicate posting on retries
- If installment already paid/closed on server:
  - Mark local event `REJECTED`
  - Create conflict item with message + suggested action
  - Keep user-visible audit trail

### Client profile edits
- Last-write-wins by default for low-risk fields (address/notes)
- Field-level merge possible for notes (append mode optional)
- Risk grade changes should log audit events

### Loan metadata edits
- Require version check (`If-Match` or `serverVersion`)
- Return `409 CONFLICT` when stale

## Reliability / Security Requirements
- JWT in encrypted storage (`EncryptedSharedPreferences`)
- Local DB encryption if feasible (SQLCipher / device encryption requirement)
- TLS pinning optional for high-security deployment
- Background sync with WorkManager
- Exponential backoff for retries
- Full audit event capture for financial actions

## Suggested Android Tech Stack
- Kotlin + Jetpack Compose
- Room + SQLDelight or Room only
- Retrofit + OkHttp
- Kotlinx Serialization
- WorkManager (periodic + one-time sync)
- Hilt (DI)
- Paging 3 for lists

## Milestone Plan
1. `M1`: Login + bootstrap sync + read-only due lists
2. `M2`: Collection entry (online only) + audit-safe backend integration
3. `M3`: Offline outbox + push/pull sync + conflict handling
4. `M4`: Expenses + reports + reminders
5. `M5`: Hardening (roles, telemetry, crash reporting, encryption)
