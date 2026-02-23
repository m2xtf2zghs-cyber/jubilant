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
