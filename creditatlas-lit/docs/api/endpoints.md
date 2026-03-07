# API Surface

## Auth
- `POST /auth/login`
- `GET /auth/me`

## Borrowers
- `POST /borrowers`
- `GET /borrowers`
- `GET /borrowers/{borrower_id}`

## Cases
- `POST /cases`
- `GET /cases/{case_id}`
- `GET /cases/{case_id}/summary`

## Documents
- `POST /cases/{case_id}/documents/upload`
- `GET /cases/{case_id}/documents`

## Ingestion
- `POST /cases/{case_id}/bank-ingestion/finbox`
- `GET /cases/{case_id}/bank-ingestion/status`
- `POST /cases/{case_id}/bank-ingestion/reprocess`

## Intelligence
- `GET /cases/{case_id}/transactions`
- `GET /cases/{case_id}/transactions/monthly-summary`
- `GET /cases/{case_id}/counterparties`
- `GET /cases/{case_id}/emi-tracker`
- `GET /cases/{case_id}/street-lender-intelligence`
- `GET /cases/{case_id}/truth-engine`
- `GET /cases/{case_id}/credit-brain`
