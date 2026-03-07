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

## One-Command API Smoke Test

Run a local end-to-end API smoke test (auth -> borrower/case -> document upload -> ingestion -> engines -> credit brain):

```bash
python3 scripts/smoke_test.py
```

Optional:

```bash
python3 scripts/smoke_test.py --db-url sqlite:////tmp/creditatlas_smoke_alt.db --preserve-db
```

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

## Notes

- Business logic is intentionally deterministic and explainable.
- Vendor-specific response fields are mapped into canonical schemas before engine use.
- Ingestion is idempotent via external reference and transaction dedupe keys.
