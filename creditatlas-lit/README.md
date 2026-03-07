# CreditAtlas LIT MVP

CreditAtlas LIT is a lender-focused borrower intelligence terminal for MSME underwriting. This repository provides an MVP vertical slice from borrower/case creation through bank ingestion and decision output.

## Monorepo Layout

```text
/apps
  /web                 # Next.js 15 + TypeScript analyst frontend
  /api                 # FastAPI API + SQLAlchemy models + Alembic
/services
  /worker              # Celery worker runtime
/infrastructure
  docker-compose.yml   # Local stack: web, api, worker, postgres, redis, minio
/packages
  /schemas             # Shared TS schema package (frontend contracts)
/docs
  /product
  /api
```

## Quick Start

1. Copy env defaults:

```bash
cp .env.example .env
```

2. Start local stack:

```bash
docker compose -f infrastructure/docker-compose.yml up --build
```

3. Run DB migration (from another terminal):

```bash
docker compose -f infrastructure/docker-compose.yml exec api alembic upgrade head
```

4. Seed sample borrower case:

```bash
docker compose -f infrastructure/docker-compose.yml exec api python -m app.seed
```

5. Open app:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001

## Demo Login

- Email: `analyst@creditatlas.local`
- Password: `Password@123`

## Production Hardening Controls

- Strict RBAC roles: `ANALYST`, `MANAGER`, `ADMIN`
  - `/cases/{id}/bank-ingestion/reprocess` requires `MANAGER` or `ADMIN`
- Celery-only ingestion queue by default
  - Set `ALLOW_INLINE_INGESTION_FALLBACK=true` only for local troubleshooting
- Migration guard at startup
  - Set `ENFORCE_MIGRATION_CHECK=true` to block startup when DB revision is not at Alembic head

## One-Command API Smoke Test

Run a local end-to-end API smoke test (auth -> borrower/case -> document upload -> ingestion -> engines -> credit brain):

```bash
python3 scripts/smoke_test.py
```

Optional:

```bash
python3 scripts/smoke_test.py --db-url sqlite:////tmp/creditatlas_smoke_alt.db --preserve-db
```

## API Tests

```bash
cd apps/api
python3 -m pip install -r requirements-dev.txt
pytest
```

## CI/CD

- GitHub Actions CI workflow:
  - API lint/type/test
  - Web build check
  - Smoke test run
- Docker build workflow:
  - Builds `api`, `worker`, `web` images on push/PR

## Release Ops

- Release checklist:
  - [`docs/release/release-checklist.md`](docs/release/release-checklist.md)

## MVP Capabilities

- Tenant-aware auth and workspace scoping
- Borrower/case management
- Document upload to S3-compatible storage (MinIO)
- FinBox ingestion adapter with raw payload retention
- Canonical transaction warehouse
- Counterparty normalization + alias clustering
- EMI detection, Street Lender Intelligence, Truth Engine
- Deterministic Credit Brain v1 recommendation output
- Lender cockpit UI for case review and decisioning

## Phase 2 Add-on (Implemented)

- GST verification adapter layer with provider fallback
  - Primary: `ClearGSTProvider`
  - Backup: `KarzaGSTProvider`
- Canonical GST profile persistence in `gst_profiles`
- Raw GST vendor payload retention in `vendor_payloads`
- Endpoints:
  - `POST /cases/{case_id}/gst/verify`
  - `GET /cases/{case_id}/gst/profile`

## Export Endpoints

- `GET /cases/{case_id}/export/json` (canonical export payload)
- `GET /cases/{case_id}/export/pdf` (downloadable PDF summary)
- `GET /cases/{case_id}/export/excel` (downloadable XLSX workbook)

## Notes

- Business logic is intentionally deterministic and explainable.
- Vendor-specific response fields are mapped into canonical schemas before engine use.
- Ingestion is idempotent via external reference and transaction dedupe keys.
