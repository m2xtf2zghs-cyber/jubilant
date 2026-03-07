# CreditAtlas Release Checklist

## 1. Pre-Release Validation

- [ ] Confirm branch is up to date with `main`
- [ ] Ensure CI is green:
  - [ ] API lint (`ruff`)
  - [ ] API type check (`mypy`)
  - [ ] API tests (`pytest`)
  - [ ] Web build (`next build`)
  - [ ] Smoke test (`python scripts/smoke_test.py`)
- [ ] Confirm Docker image builds succeed for `api`, `worker`, `web`

## 2. Database & Migration Safety

- [ ] Verify pending migrations with Alembic
- [ ] Apply migrations in staging first
- [ ] Validate `ENFORCE_MIGRATION_CHECK=true` in runtime env
- [ ] Take database backup snapshot before production migration
- [ ] Run `alembic upgrade head` in production during maintenance window

## 3. Runtime Environment Checks

- [ ] API env vars set and rotated (`SECRET_KEY`, DB, Redis, S3)
- [ ] Celery broker and workers healthy
- [ ] Object storage bucket reachable and writable
- [ ] `ALLOW_INLINE_INGESTION_FALLBACK=false` in production
- [ ] CORS origins match frontend deployment URL

## 4. Post-Deploy Verification

- [ ] Login succeeds for analyst and manager/admin users
- [ ] Borrower/case creation works
- [ ] FinBox ingestion queues and processes successfully
- [ ] Credit Brain output visible on case page
- [ ] Export endpoints return valid JSON/PDF/XLSX
- [ ] GST verify/profile endpoints return canonical data

## 5. Rollback Plan

### App Rollback

- [ ] Keep previous stable image tags for `api`, `worker`, `web`
- [ ] Roll back deployment to previous image set
- [ ] Verify API health and queue processing after rollback

### Migration Rollback

- [ ] Avoid destructive down migrations in production unless tested
- [ ] If migration caused issues, restore DB snapshot and redeploy previous app image
- [ ] Replay queued ingestion jobs if needed after restore

### Incident Notes

- [ ] Log incident timeline and root cause
- [ ] Add preventive checks to CI or release checklist before next release
