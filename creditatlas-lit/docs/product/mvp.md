# CreditAtlas LIT MVP Product Notes

- Focus: Banking-core lender intelligence for MSME underwriting.
- Included: Auth, borrower/case workflow, document management, FinBox ingestion adapter, canonical transaction warehouse, engines, and decision cockpit.
- Excluded from MVP: GST, ITR/26AS, MCA/legal, portfolio layer.

## Non-negotiables implemented

- Raw vendor payload retention (`vendor_payloads.payload`)
- Idempotent ingestion by external reference and transaction dedupe keys
- Reprocess endpoint
- Tenant scoping via `org_id`
- Explainable deterministic engine outputs
