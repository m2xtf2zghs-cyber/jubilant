# macOS Distribution Plan

This project can now ship in two modes:

1. `bank-intel` CLI binary for terminal-first users
2. `BankIntel.app` wrapper that launches the local backend and opens `/console`

## Install locally

```bash
/opt/homebrew/bin/python3.12 -m venv .venv312
.venv312/bin/pip install -e '.[dev,desktop]'
```

## Run locally

```bash
.venv312/bin/bank-intel desktop
```

Useful CLI commands:

```bash
.venv312/bin/bank-intel parse statement.pdf --export
.venv312/bin/bank-intel integrity statement.pdf
.venv312/bin/bank-intel parse statement.pdf --remote --server https://your-backend.example.com --export
```

## Build macOS artifacts

```bash
./scripts/build_macos_app.sh
```

This produces:

- `dist/BankIntelCLI`
- `dist/BankIntel.app`

## Online parsing model

For a Perfios-style hosted workflow, deploy the FastAPI backend and point the CLI/app to it:

```bash
export REMOTE_PARSE_BASE_URL=https://your-backend.example.com
export REMOTE_PARSE_API_KEY=your-token
.venv312/bin/bank-intel parse statement.pdf --remote --export
```

## Original vs edited detection

The integrity module is heuristic, not a legal proof. It checks:

- incremental-save history in the PDF structure
- digital signature markers
- creator / producer metadata
- image-only vs searchable-text page mix
- redaction / JavaScript / embedded-file markers

Verdicts include:

- `LIKELY_ORIGINAL`
- `SCANNED_ORIGINAL_LIKELY`
- `DIGITALLY_GENERATED_OR_EXPORTED`
- `LIKELY_EDITED`
- `DIGITALLY_SIGNED`

## Distribution readiness

This repo now has a packaging path, but it is not notarization-ready by itself.

Before external distribution, add:

- Apple Developer signing identity
- hardened runtime signing for the app bundle
- notarization submission and staple flow
- production auth on the hosted backend
- TLS and storage controls for uploaded statements
