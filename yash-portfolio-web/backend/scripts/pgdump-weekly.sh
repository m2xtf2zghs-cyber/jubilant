#!/usr/bin/env bash
set -euo pipefail

# Weekly full PostgreSQL dump with retention-friendly naming.
# Requires: pg_dump, gzip

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${BACKEND_DIR}/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "${BACKEND_DIR}/.env" | xargs)
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install PostgreSQL client tools and retry." >&2
  exit 1
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "gzip not found." >&2
  exit 1
fi

BACKUP_DIR="${PGDUMP_BACKUP_DIR:-${BACKEND_DIR}/backups/pgdump}"
RETENTION_WEEKS="${PGDUMP_RETENTION_WEEKS:-12}"
NAME_PREFIX="${PGDUMP_NAME_PREFIX:-yash-portfolio-db}"

mkdir -p "${BACKUP_DIR}"

YEAR="$(date -u +%G)"
WEEK="$(date -u +%V)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE_BASENAME="${NAME_PREFIX}-weekly-${YEAR}-W${WEEK}-${STAMP}.sql.gz"
OUT_PATH="${BACKUP_DIR}/${FILE_BASENAME}"

echo "[pgdump] writing ${OUT_PATH}"
pg_dump "${DATABASE_URL}" | gzip -9 > "${OUT_PATH}"

# Keep only the newest N weekly files for this prefix.
KEEP="${RETENTION_WEEKS}"
if [[ "${KEEP}" =~ ^[0-9]+$ ]] && (( KEEP > 0 )); then
  mapfile -t FILES < <(ls -1t "${BACKUP_DIR}/${NAME_PREFIX}-weekly-"*.sql.gz 2>/dev/null || true)
  if (( ${#FILES[@]} > KEEP )); then
    for f in "${FILES[@]:KEEP}"; do
      rm -f -- "$f"
      echo "[pgdump] pruned ${f}"
    done
  fi
fi

echo "[pgdump] complete"
echo "${OUT_PATH}"
