# Yash Portfolio Backend (Starter)

Node/Express + PostgreSQL backend scaffold for the Yash Portfolio app.

## What is implemented now
- JWT auth: `POST /api/v1/auth/login`, `refresh`, `logout`
- Health check: `GET /health`
- Clients: list/create/detail/update/client loans
- Loans: list/create/detail/close (create initializes installment split metadata + ledger disbursement)
- Installments: list/filter
- Collections: list/detail/create (atomic posting with exact split for new entries)
- Expenses: list/create (creates matching ledger debit)
- Ledger: list/day-book/manual entry
- Dashboard: summary + risk
- Reports: client arrears, monthly P&L, collections efficiency, top collections, expense mix, monthly ledger summary

## Not implemented yet (scaffolded)
- Some report endpoints from the design doc (`balance-sheet`, `client-profitability`)

## Setup
1. Copy env file
```bash
cp .env.example .env
```
2. Install dependencies
```bash
npm install
```
3. Create PostgreSQL database and apply schema
```bash
psql "$DATABASE_URL" -f schema.sql
```
4. Start server
```bash
npm run dev
```

## Render Deployment (Recommended)
This repo is a monorepo-style workspace and the backend is inside a subfolder.

Prepared Render Blueprint file:
- `../render-backend.yaml` (relative to this README)

### Deploy on Render (Dashboard Blueprint)
1. Create a PostgreSQL database on Render (or use external Postgres).
2. In Render, create a new Blueprint service and choose this repo.
3. Select custom Blueprint file path:
   - `yash-portfolio-web/render-backend.yaml`
4. Set `DATABASE_URL` in the backend service env vars (Blueprint keeps it manual with `sync: false`).
   - Keep `CORS_ORIGIN=https://yash-portfolio-manager-v5-20260223.netlify.app`
   - Optional (recommended): `CORS_ALLOW_NETLIFY_PREVIEWS=true` to allow Netlify preview/unique deploy URLs automatically
5. Deploy. The Blueprint runs:
   - `npm ci`
   - `npm run db:apply-schema` (pre-deploy)
   - `npm start`

### Seed admin after first deploy
Open Render Shell for the backend service and run:
```bash
cd /opt/render/project/src/yash-portfolio-web/backend
npm run seed:admin -- --orgCode=ymjcapital --orgName="YMJ Capital" --adminEmail=jegan@example.com --adminPassword=jegan --adminName="Jegan"
```

The seed script is idempotent (safe to rerun). You can use it to reset the admin password/email later.
Example password reset:
```bash
npm run seed:admin -- --orgCode=ymjcapital --orgName="YMJ Capital" --adminEmail=jegan3388@gmail.com --adminPassword=yashwath --adminName="Jegan"
```

### Netlify frontend connection (after backend URL is live)
Set Netlify env var:
- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com`

Then redeploy the frontend.

## Seed Admin Login (Organization + User)
Use the seed script after applying schema:
```bash
npm run seed:admin
```

Optional args / envs:
- `--orgCode=ymjcapital`
- `--orgName=\"YMJ Capital\"`
- `--adminEmail=jegan@example.com`
- `--adminPassword=jegan123`
- `--adminName=\"Jegan\"`
- `--adminRole=OWNER`

Default local URL: `http://localhost:8787`

## Backup / Export Routine (JSON)
Create a portable JSON backup of your finance data tables:

```bash
npm run backup:json -- --orgCode=ymjcapital
```

Output:
- Writes to `./backups/` by default (timestamped file)
- Includes organizations/users/clients/loans/installments/collections/expenses/ledger/audit/etc.
- With `--orgCode=...`, exports only that organization's rows (plus the matching `organizations` record)

Optional flags:
- `--out=./backups/ymjcapital-latest.json`
- `--orgCode=ymjcapital`

Recommended:
- Run this daily/weekly and store a copy in secure cloud storage (private drive/S3)
- Also keep periodic PostgreSQL physical dumps (`pg_dump`) for disaster recovery

## S3 Backup Upload (recommended)
Upload a generated JSON backup directly to Amazon S3:

```bash
npm run backup:json:s3 -- --orgCode=ymjcapital
```

Required env vars (local/Render Cron):
- `AWS_REGION`
- `S3_BACKUP_BUCKET`
- `S3_BACKUP_PREFIX` (optional, default: `yash-portfolio`)
- Standard AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`)

S3 object naming (retention-friendly):
- Daily timestamped: `.../json/daily/YYYY/MM/ymjcapital-YYYYMMDDTHHMMSSZ.json`
- Daily latest pointer: `.../json/daily/ymjcapital-latest.json`
- Month-end snapshot (auto on last day): `.../json/monthly/YYYY/ymjcapital-YYYY-MM.json`
- Year-end snapshot (auto on Dec 31): `.../json/yearly/YYYY/ymjcapital-YYYY.json`

Use S3 Lifecycle rules for retention:
- Daily (`/json/daily/`): expire after 30 days
- Monthly (`/json/monthly/`): expire after 365 days
- Yearly (`/json/yearly/`): expire after 2555 days (7 years)

## Weekly pg_dump Script (full DB backup)
Script file:
- `scripts/pgdump-weekly.sh`

Example run (from environment that has `pg_dump` installed):
```bash
chmod +x scripts/pgdump-weekly.sh
./scripts/pgdump-weekly.sh
```

Optional envs:
- `PGDUMP_BACKUP_DIR` (default `./backups/pgdump`)
- `PGDUMP_RETENTION_WEEKS` (default `12`)
- `PGDUMP_NAME_PREFIX` (default `yash-portfolio-db`)

Filename pattern (retention-friendly):
- `yash-portfolio-db-weekly-YYYY-Www.sql.gz`

Note:
- Render native Node services/cron jobs may not include `pg_dump`. Run this from:
  - a small VM
  - GitHub Actions runner
  - local machine with PostgreSQL client tools installed

## Render Cron Job (daily JSON -> S3)
Prepared Blueprint file:
- `../render-backup-cron.yaml`

Suggested schedule:
- `0 17 * * *` (runs at `10:30 PM IST`, Render cron uses UTC)

Set these env vars on the cron service:
- `DATABASE_URL` (use Render Postgres external URL unless cron is in same region and using internal networking)
- `AWS_REGION`
- `S3_BACKUP_BUCKET`
- `S3_BACKUP_PREFIX`
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

## Frontend integration notes
- Base URL: `/api/v1`
- Use `Authorization: Bearer <accessToken>`
- Use `X-Org-Id: <organization_id_from_login>`
- Use `Idempotency-Key` for write requests (supported in `POST /expenses` and `POST /collections`)

## Important schema note (exact accounting split)
`collections` includes:
- `principal_component`
- `interest_component`
- `split_method`

These support CA-ready interest/principal split reporting. If your DB was created before this backend starter, re-run the schema or apply an `ALTER TABLE collections ...` migration for those columns.

## Seed user (manual)
Create an organization + user in PostgreSQL and store a `bcrypt` password hash in `users.password_hash`.

Example hash generation (Node):
```bash
node -e "console.log(require('bcryptjs').hashSync('jegan', 10))"
```
