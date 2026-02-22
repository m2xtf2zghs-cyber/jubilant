# Statement Autopilot FastAPI Service

Backend parser + strict reconciliation + optional template-clone Excel generator for Statement Autopilot.

## What it does

- Pulls PDFs for a `statement_versions.id` from Supabase Storage.
- Extracts/stores strict raw lines (`TRANSACTION` + `NON_TXN_LINE`).
- Merges multiline transactions.
- Hard-fails parse when any transaction-start line remains unmapped.
- Optionally generates output XLSX by cloning the styled template workbook.
- Writes normalized transactions, monthly aggregates, pivots, and audit event.

## Schema

Run this first in Supabase SQL Editor:

- `/Users/jegannathan/Documents/New project/jubilant/STATEMENT_AUTOPILOT_CORE_SCHEMA.sql`

## Environment variables

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `SUPABASE_BUCKET` (default: `statements`)
- `PERFIOS_TEMPLATE_PATH`
- `STATEMENT_WORKBOOK_ENABLED` (default: `true`; set `false` to disable workbook generation)

Template fallback order (used only when `STATEMENT_WORKBOOK_ENABLED=true`):

1. `PERFIOS_TEMPLATE_PATH`
2. `/Users/jegannathan/Documents/New project/jubilant/fixtures/AFFAN METALS-FINAL WORKINGS- 05-02-2026.xlsx`
3. `/Users/jegannathan/Documents/New project/jubilant/statement_service/templates/perfios_template.xlsx`
4. `/Users/jegannathan/Downloads/AFFAN METALS-FINAL WORKINGS- 05-02-2026.xlsx`

## Run locally

```bash
cd "/Users/jegannathan/Documents/New project/jubilant/statement_service"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export SUPABASE_BUCKET="statements"
# optional: disable workbook/template dependency
# export STATEMENT_WORKBOOK_ENABLED="false"
# optional
# export PERFIOS_TEMPLATE_PATH="/absolute/path/to/template.xlsx"

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `POST /jobs/parse_statement/{version_id}`

Example:

```bash
curl -X POST "http://127.0.0.1:8000/jobs/parse_statement/<version_id>"
```

Successful response:

```json
{
  "status": "READY",
  "excel_path": null,
  "workbook_path": null,
  "workbook_active": false,
  "transactions": 123,
  "continuity_failures": 0
}
```

## Deploy backend (Render)

This repo includes a Render blueprint:

- `/Users/jegannathan/Documents/New project/jubilant/render.yaml`

Steps:

1. Push current repo changes to GitHub.
2. In Render: New + -> Blueprint.
3. Select `https://github.com/m2xtf2zghs-cyber/jubilant`.
4. Set required env vars in Render:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STATEMENT_WORKBOOK_ENABLED=false` (recommended if you only need parsing + underwriting data and not XLSX workbook generation)
5. Deploy and copy the service URL (example: `https://jubilant-statement-service.onrender.com`).

Then set this in Netlify (frontend):

- `VITE_STATEMENT_SERVICE_URL=<your-render-url>`
