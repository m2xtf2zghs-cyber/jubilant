from __future__ import annotations

import argparse
import json
import shutil
import sys
import threading
import time
import uuid
import webbrowser
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from sqlalchemy import text

from app.clients import RemoteParseClient
from app.core.settings import get_settings
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.integrity import PdfIntegrityAnalyzer
from app.models.transaction import Transaction
from app.services.export_service import ExportService
from app.services.job_service import JobService
from app.services.parsing_service import ParsingService
from app.utils.uploads import (
    UploadValidationError,
    allocate_upload_path,
    prepare_upload_dir,
    validate_local_pdf,
    validate_upload_count,
)
from app.utils.text import sanitize_filename


def _read_text(path: str | None) -> str | None:
    if not path:
        return None
    return Path(path).read_text(encoding="utf-8")


def _resolve_files(paths: list[str]) -> list[Path]:
    settings = get_settings()
    files = [Path(p).expanduser().resolve() for p in paths]
    missing = [str(path) for path in files if not path.exists()]
    if missing:
        raise SystemExit(f"missing files: {', '.join(missing)}")
    try:
        validate_upload_count(len(files), settings)
        for path in files:
            validate_local_pdf(path, settings)
    except UploadValidationError as exc:
        raise SystemExit(str(exc)) from exc
    return files


def _integrity_to_dict(result) -> dict[str, Any]:
    return {
        "file_name": result.file_name,
        "verdict": result.verdict,
        "score": result.score,
        "confidence": result.confidence,
        "summary": result.summary,
        "page_count": result.page_count,
        "text_page_count": result.text_page_count,
        "image_only_page_count": result.image_only_page_count,
        "is_encrypted": result.is_encrypted,
        "has_digital_signature": result.has_digital_signature,
        "has_incremental_updates": result.has_incremental_updates,
        "creator": result.creator,
        "producer": result.producer,
        "creation_date": result.creation_date,
        "mod_date": result.mod_date,
        "signals": [{"code": s.code, "severity": s.severity, "message": s.message} for s in result.signals],
    }


def _local_integrity(files: list[Path]) -> list[dict[str, Any]]:
    analyzer = PdfIntegrityAnalyzer()
    return [_integrity_to_dict(analyzer.analyze(str(path))) for path in files]


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _local_parse(files: list[Path], *, job_name: str, rules_yaml: str | None, export: bool) -> dict[str, Any]:
    settings = get_settings()
    init_db()
    db = SessionLocal()
    try:
        integrity = _local_integrity(files)
        stored: list[tuple[str, str]] = []
        upload_dir = prepare_upload_dir(settings.upload_path, f"cli-{uuid.uuid4().hex}")
        for index, path in enumerate(files, start=1):
            target = allocate_upload_path(upload_dir, index, sanitize_filename(path.name))
            shutil.copyfile(path, target)
            stored.append((path.name, str(target.resolve())))

        job = JobService(db).create_job(job_name, stored, notes=rules_yaml)
        ParsingService(db, settings.config_path).parse_job(job.id)

        txns = db.query(Transaction).filter(Transaction.job_id == job.id).all()
        accounts: dict[str, dict[str, Any]] = {}
        for txn in txns:
            key = txn.account.account_key if txn.account else f"{txn.source_bank}-UNKNOWN"
            bucket = accounts.setdefault(
                key,
                {
                    "source_bank": txn.source_bank,
                    "source_account_no": txn.source_account_no,
                    "source_account_name": txn.source_account_name,
                    "source_account_type": txn.source_account_type,
                    "txn_count": 0,
                    "debit_total": 0.0,
                    "credit_total": 0.0,
                },
            )
            bucket["txn_count"] += 1
            bucket["debit_total"] += txn.debit
            bucket["credit_total"] += txn.credit

        payload: dict[str, Any] = {
            "mode": "local",
            "job_id": job.id,
            "status": "PARSED",
            "files": [name for name, _ in stored],
            "integrity_results": integrity,
            "accounts": [{"account_key": key, **value} for key, value in accounts.items()],
        }
        if export:
            exported = ExportService(db, settings.export_path).export_job_workbook(job.id)
            payload["export_file"] = exported.file_path
        return payload
    finally:
        db.close()


def _remote_base_url(server: str | None) -> str:
    settings = get_settings()
    base_url = server or settings.remote_parse_base_url
    if not base_url:
        raise SystemExit("remote mode requires --server or REMOTE_PARSE_BASE_URL")
    return base_url.rstrip("/")


def _remote_client(server: str | None) -> RemoteParseClient:
    settings = get_settings()
    return RemoteParseClient(
        _remote_base_url(server),
        api_key=settings.remote_parse_api_key,
        timeout=settings.remote_parse_timeout_sec,
    )


def serve_command(args: argparse.Namespace) -> int:
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=False)
    return 0


def desktop_command(args: argparse.Namespace) -> int:
    if args.open:
        def _open() -> None:
            time.sleep(1.25)
            webbrowser.open(f"http://{args.host}:{args.port}/console")

        threading.Thread(target=_open, daemon=True).start()
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=False)
    return 0


def parse_command(args: argparse.Namespace) -> int:
    files = _resolve_files(args.files)
    rules_yaml = _read_text(args.rules)
    if args.remote:
        client = _remote_client(args.server)
        payload = client.upload_and_parse(files, job_name=args.job_name, borrower_rules_yaml=rules_yaml)
        if args.export:
            client.export_workbook(payload["job_id"])
            payload["export_file"] = str(client.download_latest_export(payload["job_id"], Path(args.download_dir).expanduser().resolve()))
        _print_json(payload)
        return 0

    payload = _local_parse(files, job_name=args.job_name, rules_yaml=rules_yaml, export=args.export)
    _print_json(payload)
    return 0


def integrity_command(args: argparse.Namespace) -> int:
    files = _resolve_files(args.files)
    if args.remote:
        payload = _remote_client(args.server).integrity_check(files)
    else:
        payload = _local_integrity(files)
    _print_json(payload)
    return 0


def export_command(args: argparse.Namespace) -> int:
    if args.remote:
        client = _remote_client(args.server)
        client.export_workbook(args.job_id)
        path = client.download_latest_export(args.job_id, Path(args.output_dir).expanduser().resolve())
        _print_json({"mode": "remote", "job_id": args.job_id, "export_file": str(path)})
        return 0

    settings = get_settings()
    init_db()
    db = SessionLocal()
    try:
        exported = ExportService(db, settings.export_path).export_job_workbook(args.job_id)
        _print_json({"mode": "local", "job_id": args.job_id, "export_file": exported.file_path})
        return 0
    finally:
        db.close()


def doctor_command(args: argparse.Namespace) -> int:
    settings = get_settings()
    init_db()

    db = SessionLocal()
    checks: dict[str, Any] = {
        "env": settings.env,
        "database_url": settings.database_url,
        "upload_dir": str(settings.upload_path.resolve()),
        "export_dir": str(settings.export_path.resolve()),
        "max_upload_mb": settings.max_upload_mb,
        "max_files_per_job": settings.max_files_per_job,
        "auth_configured": bool(settings.auth_token_list),
        "console_enabled": settings.enable_console,
    }
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    finally:
        db.close()

    if args.remote:
        client = _remote_client(args.server)
        with httpx.Client(timeout=settings.remote_parse_timeout_sec, headers=client._headers()) as http_client:
            response = http_client.get(f"{client.base_url}/api/health/ready")
            response.raise_for_status()
            checks["remote"] = response.json()

    _print_json(checks)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bank-intel", description="Bank Intel CLI for desktop and remote parsing workflows")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve = subparsers.add_parser("serve", help="Run the local backend API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.set_defaults(func=serve_command)

    desktop = subparsers.add_parser("desktop", help="Run the local backend and open the analyst console")
    desktop.add_argument("--host", default="127.0.0.1")
    desktop.add_argument("--port", type=int, default=8000)
    desktop.add_argument("--open", action=argparse.BooleanOptionalAction, default=True)
    desktop.set_defaults(func=desktop_command)

    parse = subparsers.add_parser("parse", help="Parse one or more bank statement PDFs")
    parse.add_argument("files", nargs="+")
    parse.add_argument("--job-name", default="Statement Parse Job")
    parse.add_argument("--rules", help="Borrower YAML rules file")
    parse.add_argument("--export", action="store_true")
    parse.add_argument("--remote", action="store_true", help="Use hosted backend instead of the local engine")
    parse.add_argument("--server", help="Hosted backend base URL, for example https://parse.example.com")
    parse.add_argument("--download-dir", default="./data/exports")
    parse.set_defaults(func=parse_command)

    integrity = subparsers.add_parser("integrity", help="Check whether a PDF looks original, scanned, or edited")
    integrity.add_argument("files", nargs="+")
    integrity.add_argument("--remote", action="store_true")
    integrity.add_argument("--server", help="Hosted backend base URL")
    integrity.set_defaults(func=integrity_command)

    export = subparsers.add_parser("export", help="Build and download workbook export for an existing job")
    export.add_argument("job_id")
    export.add_argument("--remote", action="store_true")
    export.add_argument("--server", help="Hosted backend base URL")
    export.add_argument("--output-dir", default="./data/exports")
    export.set_defaults(func=export_command)

    doctor = subparsers.add_parser("doctor", help="Run local or remote readiness checks")
    doctor.add_argument("--remote", action="store_true")
    doctor.add_argument("--server", help="Hosted backend base URL")
    doctor.set_defaults(func=doctor_command)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
