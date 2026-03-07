# PR Summary: CreditAtlas LIT MVP Stack

## Branch

- `codex/creditatlas-lit-mvp-stack`

## Commits Included

1. `d7b05ef` feat: creditatlas lit mvp + smoke test
2. `3b52d26` feat: production hardening for api security/rbac/queue/migrations/tests
3. `ae0fa1c` feat: add gst provider adapters and canonical gst profile endpoints
4. `6f6f93c` feat: add case export endpoints for json pdf and excel
5. `5e7becc` chore: add ci workflows docker build pipeline and release checklist

## Scope

- Full CreditAtlas LIT MVP vertical slice (web + api + worker + infra + seed)
- Security hardening:
  - strict JWT/password handling
  - RBAC enforcement (`ANALYST`, `MANAGER`, `ADMIN`)
  - queue-unavailable handling and migration guard
- GST Phase 2 module:
  - provider adapters (`Clear` primary, `Karza` fallback)
  - canonical `gst_profiles` storage
  - GST verify/profile API endpoints
- Export module:
  - `/cases/{id}/export/json`
  - `/cases/{id}/export/pdf`
  - `/cases/{id}/export/excel`
- CI/CD:
  - API lint/type/test
  - web build check
  - smoke test run
  - Docker build workflow for api/worker/web

## API Additions

- `POST /cases/{case_id}/gst/verify`
- `GET /cases/{case_id}/gst/profile`
- `GET /cases/{case_id}/export/json`
- `GET /cases/{case_id}/export/pdf`
- `GET /cases/{case_id}/export/excel`

## Migration Checklist

- [ ] Apply `0002_user_roles` (adds `users.role`)
- [ ] Apply `0003_gst_profiles` (adds `gst_profiles`)
- [ ] Verify DB is at head (`alembic upgrade head`)
- [ ] Confirm `ENFORCE_MIGRATION_CHECK=true` in production

## Config Checklist

- [ ] `ALLOW_INLINE_INGESTION_FALLBACK=false` in production
- [ ] Celery broker/worker healthy
- [ ] Postgres/Redis/S3 env vars configured
- [ ] `SECRET_KEY` rotated and not default

## Risk Notes

- PDF/XLSX export generators are lightweight deterministic implementations; functional for MVP export needs.
- CI workflows are scoped to the `creditatlas-lit` subtree and workflow files.

## Rollback

- Roll app images back to previous tags
- Restore DB snapshot if migration-related issue occurs
- Re-run queued ingestion jobs if needed
