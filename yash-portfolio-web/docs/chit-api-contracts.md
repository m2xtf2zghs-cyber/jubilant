# Chit Funding ROI API Contracts (Phase 1)

Base path: `/api/v1/chits`
Auth: `Authorization: Bearer <token>` + `X-Org-Id`

## 1) Chit Register

### `GET /api/v1/chits`
List chits with filters and summary columns.

Query params:
- `status=RUNNING|CLOSED|CANCELLED`
- `organizer`
- `fromDate=YYYY-MM-DD`
- `toDate=YYYY-MM-DD`
- `q` (name/group search)
- `page`, `pageSize`

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "chitCode": "CHIT-20260224-AB12",
      "chitName": "A Group",
      "groupName": "A Group 50L",
      "organizer": "ABC Chits",
      "faceValue": 5000000,
      "tenureMonths": 20,
      "installmentAmount": 250000,
      "startDate": "2026-01-10",
      "expectedEndDate": "2027-08-10",
      "drawDate": "2026-06-10",
      "amountReceived": 4200000,
      "status": "RUNNING",
      "totalPaid": 1250000,
      "remainingDue": 3750000,
      "availableChitBalance": 900000,
      "utilizationPct": 78.57
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### `POST /api/v1/chits`
Create chit master and auto-generate installment schedule.

Request:
```json
{
  "chitName": "A Group",
  "groupName": "A Group 50L",
  "organizer": "ABC Chits",
  "faceValue": 5000000,
  "tenureMonths": 20,
  "installmentAmount": 250000,
  "startDate": "2026-01-10",
  "drawType": "AUCTION",
  "bankAccountRef": "HDFC-CC-001",
  "accountingTreatmentMode": "FINANCING",
  "notes": "Primary working capital chit"
}
```

Response:
```json
{
  "item": { "id": "uuid", "status": "RUNNING", "...": "..." },
  "schedule": [{ "installmentNo": 1, "dueDate": "2026-01-10", "expectedAmount": 250000 }],
  "journalPreview": []
}
```

### `GET /api/v1/chits/:chitId`
Chit detail + computed balances.

### `PATCH /api/v1/chits/:chitId`
Update chit master (restricted to OWNER in implementation).

### `DELETE /api/v1/chits/:chitId`
Soft close/cancel chit (restricted to OWNER).

## 2) Payments (Schedule + Actual)

### `GET /api/v1/chits/:chitId/installments`
Returns generated schedule with actual paid totals and reconciliation status.

Response (shape):
```json
{
  "items": [
    {
      "id": "uuid",
      "installmentNo": 1,
      "dueDate": "2026-01-10",
      "expectedAmount": 250000,
      "paidAmount": 125000,
      "reconciliationStatus": "PARTIAL",
      "overdueDays": 14,
      "variance": 125000,
      "payments": [{ "id": "uuid", "paymentDate": "2026-01-20T10:30:00Z", "amountPaid": 125000 }]
    }
  ]
}
```

### `POST /api/v1/chits/:chitId/payments`
Record actual installment payment (partial/full).

Request:
```json
{
  "chitInstallmentId": "uuid",
  "paymentDate": "2026-01-20T10:30:00Z",
  "amountPaid": 125000,
  "mode": "BANK",
  "reference": "UTR123",
  "narration": "Jan installment",
  "linkedBankEntryId": "uuid-optional"
}
```

Response includes:
- payment row
- updated installment row
- generated chit journal entries
- optional mirrored ledger entry

## 3) Receipt (Draw Event)

### `GET /api/v1/chits/:chitId/receipt`
Fetch draw receipt details (if recorded).

### `POST /api/v1/chits/:chitId/receipt`
Create/update chit draw receipt.

Request:
```json
{
  "drawDate": "2026-06-10T11:00:00Z",
  "amountReceived": 4200000,
  "discountAmount": 800000,
  "commissionAmount": 25000,
  "otherCharges": 5000,
  "feesPaidSeparately": true,
  "receiptMode": "BANK",
  "reference": "UTR-CHIT-001",
  "linkedBankEntryId": "uuid-optional",
  "notes": "Auction draw credited"
}
```

## 4) Allocation (Funds Source Tagging)

### `GET /api/v1/chits/:chitId/allocations`
List allocations tagged to a chit.

### `POST /api/v1/chits/:chitId/allocations`
Add use-of-funds allocation (reduces available chit balance unless overdraft allowed).

Request:
```json
{
  "allocationDate": "2026-06-11T09:00:00Z",
  "amountAllocated": 3000000,
  "purpose": "LENDING",
  "targetEntityType": "LOAN",
  "targetEntityId": "loan-uuid",
  "linkedLoanId": "loan-uuid",
  "notes": "Tagged to 3 disbursements"
}
```

## 5) Returns (Capital Recovery + Attributed Income)

### `GET /api/v1/chits/:chitId/returns`
List returns to chit pool.

### `POST /api/v1/chits/:chitId/returns`
Record capital return / recovery and attributable income (consumed from existing interest logic output).

Request:
```json
{
  "allocationId": "uuid-optional",
  "returnDate": "2026-08-15T16:00:00Z",
  "amountReturned": 500000,
  "sourceType": "LOAN_PRINCIPAL_REPAYMENT",
  "linkedLoanId": "loan-uuid",
  "linkedCollectionId": "collection-uuid",
  "interestIncomeAmount": 45000,
  "otherIncomeAmount": 0,
  "notes": "Allocated recovery tagged back"
}
```

## 6) ROI / Analytics

### `GET /api/v1/chits/:chitId/roi`
Per-chit CFO JSON outputs.

Response:
```json
{
  "chit_summary": {
    "chitId": "uuid",
    "chitName": "A Group",
    "status": "RUNNING",
    "cost": {
      "chitXirrAnnual": 0.2142,
      "chitXirrAnnualPct": 21.42,
      "totalPaid": 1250000,
      "netProceeds": 4200000,
      "discountCost": 800000,
      "effectiveFundingCostRsEstimate": 105000
    },
    "yield": {
      "yieldXirrAnnual": 0.3125,
      "yieldXirrAnnualPct": 31.25,
      "utilizationPct": 78.57,
      "idleBalance": 900000,
      "totalAllocated": 3300000,
      "totalReturnedCapital": 500000,
      "attributedIncome": 45000
    },
    "spread": {
      "netSpread": 0.0983,
      "netSpreadPct": 9.83,
      "breakEvenYieldPct": 21.42,
      "netProfitRs": 15000,
      "profitabilityFlag": "STRONG_POSITIVE"
    }
  },
  "cashflow_series_per_chit": {
    "costCashflows": [{ "date": "2026-01-20", "amount": -125000, "type": "INSTALLMENT_PAYMENT" }],
    "yieldCashflows": [{ "date": "2026-06-11", "amount": -3000000, "type": "ALLOCATION" }]
  }
}
```

### `GET /api/v1/chits/portfolio/summary`
Portfolio blended view + stress table + audit log snapshot.

Query params:
- `fromMonth=YYYY-MM` (optional)
- `toMonth=YYYY-MM` (optional)
- `otherFixedOutflowsMonthly=number` (optional)
- `reduceInflowsPct` (optional; default 20)
- `delayCollectionsDays` (optional; default 60)
- `increaseDefaultsPct` (optional; default 10)

Response contains required structured JSON:
```json
{
  "chit_summary": ["...per-chit summaries..."],
  "portfolio_summary": {
    "runningChitsCount": 2,
    "totalMonthlyObligation": 500000,
    "blendedChitXirrAnnualPct": 18.7,
    "blendedYieldXirrAnnualPct": 29.2,
    "portfolioSpreadPct": 10.5,
    "netProfitRs": 210000
  },
  "stress_table_monthly": [
    {
      "month": "2026-08",
      "totalChitInstallmentsDue": 500000,
      "businessCashInflows": 900000,
      "otherFixedOutflows": 100000,
      "netSurplus": 300000,
      "stressRatio": 0.6,
      "stressFlag": "DANGER",
      "scenario": {
        "base": { "stressRatio": 1.6, "stressFlag": "SAFE" },
        "worstCase": { "stressRatio": 0.6, "stressFlag": "DANGER" }
      }
    }
  ],
  "cashflow_series_per_chit": [
    { "chitId": "uuid", "costCashflows": [], "yieldCashflows": [] }
  ],
  "audit_log": [{ "id": "uuid", "entityType": "CHIT_REGISTER", "action": "UPDATE", "createdAt": "..." }]
}
```

## 7) Journal + Audit

### `GET /api/v1/chits/:chitId/journal`
Returns chit module double-entry lines (`chit_journal_entries`) + linked ledger IDs.

### `GET /api/v1/chits/:chitId/audit`
Returns chit-related rows from global `audit_logs`.

## 8) Exports (Phase 2 API placeholders)
- `GET /api/v1/chits/:chitId/export/cfo-summary.pdf`
- `GET /api/v1/chits/:chitId/export/schedule.xlsx`
- `GET /api/v1/chits/export/audit-log.csv`

Phase 1 implementation returns JSON analytics and tables; PDF/Excel rendering adapters are next phase.
