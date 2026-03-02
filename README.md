# Money Lender Statement Analyser

Phase-1 remains available (`backend.cli`) and Phase-2 adds strict recon, classification, pivots, CONS, FINAL, ERRORS, and RECON (`backend.cli_phase2`).

## Premium Web UI
A premium static web UI is available under `web/` for statement uploads, run controls, pipeline status, and export actions.

Local preview:
```bash
cd /Users/jegannathan/Documents/New\ project/bank_analyzer
python -m http.server 8080
# then open http://localhost:8080/web/
```

Deploy on Netlify (from repo root):
```bash
npx netlify status
npx netlify deploy --prod
```

`netlify.toml` is preconfigured to publish `web/`.

## Backend API (for Web UI)
Run API locally:
```bash
cd /Users/jegannathan/Documents/New\ project/bank_analyzer
pip install -e .
uvicorn backend.api:app --host 0.0.0.0 --port 8000
```

API endpoints:
- `GET /health`
- `POST /analyze` (multipart form)
  - `inputs` (multiple files)
  - `entity` (optional)
  - `config_path` (optional, default `configs/default.yaml`)
  - `strict_recon` (`true/false`)
  - `include_underwriting` (`true/false`)
- `GET /status/{analysis_id}`
- `GET /download/{analysis_id}/xlsx|json|final`

In web UI, switch to `API Mode` and set `API Base URL` to your hosted backend URL (example: `https://your-api.example.com`).

## Install
```bash
cd /Users/jegannathan/Documents/New\ project/bank_analyzer
pip install -e .
```

## Run
```bash
python -m backend.cli "statement.pdf" "out.xlsx"
```

## Run Phase-2
```bash
python -m backend.cli_phase2 --inputs a.pdf b.pdf --out out_phase2.xlsx --config configs/default.yaml
```

## Save Manual Override
```bash
python -m backend.cli_phase2 --db out/overrides.db --override-txn-uid <txn_uid> --override-type "DOUBT" --override-category "MANUAL CATEGORY"
```
