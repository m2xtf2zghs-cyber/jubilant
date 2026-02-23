# Backend API Design (v1)

Base URL: `/api/v1`
Auth: JWT access token + refresh token
Headers (mobile-safe):
- `Authorization: Bearer <token>`
- `X-Org-Id: <uuid>`
- `X-Device-Id: <uuid>`
- `Idempotency-Key: <uuid>` for write operations from Android/web

## Design Rules
- All list endpoints support: `page`, `pageSize`, `sort`, `q` (when relevant).
- All write endpoints return `serverVersion` and `updatedAt` for sync conflict handling.
- Soft validation errors return `422` with field-level details.
- Offline-sensitive writes accept idempotency keys and are safe to retry.

## Auth
### POST `/auth/login`
Request:
```json
{ "email": "accounts@yashfinance.in", "password": "***", "device": { "deviceLabel": "Samsung M14", "platform": "ANDROID", "appVersion": "1.0.0" } }
```
Response:
```json
{ "accessToken": "...", "refreshToken": "...", "user": { "id": "...", "role": "ACCOUNTS_OFFICER" }, "organization": { "id": "...", "name": "Yash Finance" } }
```

### POST `/auth/refresh`
### POST `/auth/logout`

## Clients
### GET `/clients`
Filters: `q`, `riskGrade`, `hasOverdue=true|false`, `active=true|false`

### POST `/clients`
Create client profile (KYC/contact/risk/notes).

### GET `/clients/:clientId`
Returns profile + portfolio summary (`totalBorrowed`, `totalCollected`, `outstanding`, `overdueAmount`, `loanCount`).

### PATCH `/clients/:clientId`
Update contact/KYC/risk/notes.

### GET `/clients/:clientId/loans`
List all loans for client with status and collection progress.

## Loans
### GET `/loans`
Filters: `status`, `clientId`, `fromDate`, `toDate`, `overdueOnly`, `agentUserId`

### POST `/loans`
Creates loan + installment schedule + ledger disbursement.
Request:
```json
{
  "clientId": "uuid",
  "principalAmount": 100000,
  "interestAmount": 20000,
  "frequencyCode": "MONTHLY",
  "installmentCount": 10,
  "disbursedAt": "2026-02-23T10:00:00+05:30",
  "firstDueDate": "2026-02-25",
  "purpose": "Business working capital",
  "loanNotes": "Guarantor: Rajesh",
  "agentUserId": "uuid"
}
```

### GET `/loans/:loanId`
Returns loan, schedule, client snapshot, KPI summary.

### PATCH `/loans/:loanId`
Use for editable metadata (notes, purpose, assigned agent, status transitions with permissions).

### POST `/loans/:loanId/close`
Manual close remaining installments (admin/accounts officer only).

### POST `/loans/:loanId/recalculate-schedule` (optional admin endpoint)
For restructuring workflows (future).

## Installments / Collections
### GET `/installments`
Filters: `date`, `fromDate`, `toDate`, `status`, `overdue=true`, `dueToday=true`, `loanId`, `clientId`

### POST `/collections`
Records full/partial payment or write-off and updates installment + ledger atomically.
Request:
```json
{
  "loanId": "uuid",
  "installmentId": "uuid",
  "clientId": "uuid",
  "amount": 12000,
  "collectionDate": "2026-02-23T11:40:00+05:30",
  "paymentMode": "CASH",
  "isPartial": false,
  "isWriteoff": false,
  "notes": "Collected at office",
  "agentUserId": "uuid"
}
```

### GET `/collections`
Filters: `fromDate`, `toDate`, `loanId`, `clientId`, `agentUserId`, `paymentMode`

### GET `/collections/:collectionId`

## Expenses
### GET `/expenses`
Filters: `fromDate`, `toDate`, `category`, `q`

### POST `/expenses`
Creates expense and matching ledger debit.

### PATCH `/expenses/:expenseId`
Restricted to same-day or admin rules.

## Ledger / Accounting
### GET `/ledger`
Filters: `fromDate`, `toDate`, `tag`, `txType`, `loanId`, `clientId`, `q`

### POST `/ledger/manual`
Manual adjusting entry (admin/accounts officer only).

### GET `/ledger/day-book?date=YYYY-MM-DD`
Returns debit/credit rows and totals.

### GET `/accounting/opening-balance`
### PUT `/accounting/opening-balance`

## Reports / Dashboards
### GET `/dashboard/summary`
Returns cash balance, receivables, revenue, expenses, net profit, active/closed counts.

### GET `/dashboard/risk`
Returns aging buckets, overdue ratio, PAR30 ratio, next 7 day due, top overdue clients.

### GET `/reports/pnl?month=YYYY-MM`
### GET `/reports/balance-sheet?asOf=YYYY-MM-DD`
### GET `/reports/client-profitability?month=YYYY-MM` (optional filtered by `clientId`)
### GET `/reports/collections-efficiency?month=YYYY-MM`
### GET `/reports/top-collections?month=YYYY-MM&limit=10`
Returns top collection clients for the selected month (excluding write-offs).
Response:
```json
{
  "month": "2026-02",
  "items": [
    { "clientId": "uuid", "clientName": "Arun", "collectionCount": 3, "amount": 36000 }
  ]
}
```

### GET `/reports/expense-mix?month=YYYY-MM&limit=10`
Returns top expense/write-off mix plus expense-only schedule for CA/PDF reports.
Response:
```json
{
  "month": "2026-02",
  "topMix": [
    { "label": "Commission", "value": 8500 },
    { "label": "Bad Debt Write-off", "value": 5000 }
  ],
  "expenseSchedule": [
    { "label": "Commission", "value": 8500 },
    { "label": "Office Rent", "value": 12000 }
  ],
  "totals": { "expenses": 20500, "badDebt": 5000 }
}
```

### GET `/reports/monthly-ledger-summary?month=YYYY-MM`
Returns month ledger totals, tag summary, and daily trend (for report dashboard + CA PDF).
Response:
```json
{
  "month": "2026-02",
  "totals": {
    "entryCount": 42,
    "creditEntryCount": 20,
    "debitEntryCount": 22,
    "collectionEntryCount": 15,
    "expenseEntryCount": 5,
    "writeoffEntryCount": 1,
    "totalCredit": 175000,
    "totalDebit": 121500,
    "cashMovement": 53500,
    "disbursed": 100000,
    "capitalAdded": 30000,
    "openingCashBalance": 50000,
    "closingCashBalance": 103500
  },
  "tagSummary": [
    { "tag": "COLLECTION", "count": 15, "debit": 0, "credit": 175000, "net": 175000 }
  ],
  "dailyTrend": [
    { "day": "2026-02-23", "entries": 4, "inflow": 12000, "outflow": 3000, "collections": 12000, "net": 9000 }
  ]
}
```

## Reminders
### GET `/reminders/overdue-preview`
Generates reminder list (client, phone, due amount, days late, message text) without sending.

### POST `/reminders/send`
Batch create/send reminders. Writes `reminder_logs`.

### GET `/reminders/logs`

## Mobile Sync (Android Offline-First)
### POST `/sync/push`
Client uploads local operations in order.
Request:
```json
{
  "deviceId": "uuid",
  "lastKnownServerCursor": "2026-02-23T12:00:00Z_2048",
  "events": [
    {
      "clientEventId": "d3f...",
      "eventType": "RECORD_COLLECTION",
      "entityType": "collection",
      "occurredAt": "2026-02-23T11:40:00+05:30",
      "payload": { "loanId": "...", "installmentId": "...", "amount": 12000 }
    }
  ]
}
```
Response:
```json
{
  "accepted": [{ "clientEventId": "d3f...", "serverEventId": "..." }],
  "rejected": [],
  "serverCursor": "2026-02-23T12:01:20Z_2051"
}
```

### GET `/sync/pull?cursor=<serverCursor>`
Returns server-side changes since cursor (clients, loans, installments, collections, expenses, user assignments).

### POST `/sync/ack`
Optional endpoint to acknowledge applied server events on device.

## Audit / Admin
### GET `/audit-logs`
Filters: `entityType`, `entityId`, `fromDate`, `toDate`, `actorUserId`

### GET `/users`
### POST `/users`
### PATCH `/users/:userId`

## Suggested Error Contract
```json
{
  "error": {
    "code": "INSTALLMENT_ALREADY_PAID",
    "message": "Installment #3 is already fully paid",
    "details": { "installmentId": "uuid", "paidAmount": 12000 }
  }
}
```
