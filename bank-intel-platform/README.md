# Bank Intel Platform

Analyst-grade internal platform for Indian bank statement parsing, classification, detection, and workbook reconstruction.

## Scope

This repo is designed for lending/forensic underwriting workflows, not consumer finance.

Key capabilities:
- Multi-file PDF ingestion (text-PDF first; OCR-ready interface)
- Bank-aware parser registry with conservative header-based detection
- Canonical transaction normalization with PDF traceability
- Narration intelligence + classification + detection engines
- Excel workbook export mirroring analyst working model:
  - `XNS-<ACCOUNT>`
  - `PIVOT-<ACCOUNT>`
  - `ODD FIG`
  - `DOUBT`
  - `NAMES`
  - `BANK FIN`
  - `PVT FIN`
  - `RETURN`
  - `ANALYSIS`
  - `CONS`
  - `FINAL`

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload
```

## CLI

```bash
bank-intel desktop
bank-intel parse statement.pdf --export
bank-intel integrity statement.pdf
bank-intel doctor
bank-intel parse statement.pdf --remote --server https://your-backend.example.com --export
```

See [docs/macos_distribution.md](docs/macos_distribution.md) for the macOS packaging flow.
See [docs/render_deploy.md](docs/render_deploy.md) for the Render deployment flow.

## API

OpenAPI docs available at:
- `http://localhost:8000/docs`

## Run tests

```bash
pytest -q
```

## Current implementation maturity

This repository includes a production-minded starter with:
- complete backend skeleton
- strict PDF-only upload validation with file-size and file-count caps
- readiness probes, bearer-token auth hooks, and audit logging
- local and remote CLI flows, including integrity and doctor checks
- database schema
- parser interfaces + bank adapters:
  - `TMB`
  - `BOI`
  - `HDFC`
  - `SBI`
  - `ICICI`
  - `AXIS`
  - `CANARA`
  - `IOB`
  - `KVB`
  - `FEDERAL`
  - `INDUSIND`
  - `YES`
- generic parser
- classification and detection scaffolding
- workbook generator with required sheet set

OCR engines and additional bank adapters are pluggable and can be added incrementally.
