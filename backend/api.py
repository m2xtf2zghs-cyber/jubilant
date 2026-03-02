from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.cli_phase2 import run_phase2


APP_ROOT = Path(__file__).resolve().parents[1]
RUNS_DIR = APP_ROOT / "out" / "api_runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return cleaned or "upload.pdf"


def _parse_bool(value: str | bool) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _run_paths(analysis_id: str) -> dict[str, Path]:
    run_dir = RUNS_DIR / analysis_id
    return {
        "run_dir": run_dir,
        "inputs_dir": run_dir / "inputs",
        "xlsx": run_dir / "analysis.xlsx",
        "json": run_dir / "canonical.json",
        "final": run_dir / "final.txt",
        "meta": run_dir / "meta.json",
        "db": run_dir / "overrides.db",
    }


def _write_meta(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


app = FastAPI(
    title="Money Lender Statement Analyser API",
    version="0.1.0",
    description="Backend API for multi-statement parsing, underwriting, and workbook export.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "money-lender-statement-analyser-api"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "money-lender-statement-analyser-api", "docs": "/docs"}


@app.post("/analyze")
async def analyze(
    inputs: list[UploadFile] = File(...),
    entity: str = Form("Entity"),
    config_path: str = Form("configs/default.yaml"),
    strict_recon: str = Form("true"),
    include_underwriting: str = Form("true"),
) -> dict[str, str]:
    if not inputs:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    analysis_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]
    p = _run_paths(analysis_id)
    p["inputs_dir"].mkdir(parents=True, exist_ok=True)

    saved_files: list[str] = []
    input_paths: list[str] = []
    for upload in inputs:
        name = _sanitize_filename(upload.filename or "statement.pdf")
        target = p["inputs_dir"] / name
        content = await upload.read()
        target.write_bytes(content)
        saved_files.append(name)
        input_paths.append(str(target))

    cfg = config_path
    if _parse_bool(strict_recon) and config_path == "configs/default.yaml":
        strict_candidate = APP_ROOT / "configs" / "strict.yaml"
        if strict_candidate.exists():
            cfg = str(strict_candidate)

    started_at = datetime.now(timezone.utc).isoformat()
    rc = run_phase2(
        inputs=input_paths,
        out_path=str(p["xlsx"]),
        config_path=cfg,
        overrides_db=str(p["db"]),
    )
    completed_at = datetime.now(timezone.utc).isoformat()

    metadata = {
        "analysis_id": analysis_id,
        "entity": entity,
        "status": "PASS" if rc == 0 else "WARN_OR_FAIL",
        "return_code": rc,
        "include_underwriting": _parse_bool(include_underwriting),
        "strict_recon": _parse_bool(strict_recon),
        "config_path": cfg,
        "inputs": saved_files,
        "started_at": started_at,
        "completed_at": completed_at,
    }
    _write_meta(p["meta"], metadata)

    p["json"].write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    p["final"].write_text(
        "\n".join(
            [
                f"Money Lender Statement Analyser - FINAL Snapshot",
                f"Analysis ID: {analysis_id}",
                f"Entity: {entity}",
                f"Status: {metadata['status']}",
                f"Return code: {rc}",
                f"Strict Recon: {metadata['strict_recon']}",
                f"Include Underwriting: {metadata['include_underwriting']}",
                f"Inputs: {', '.join(saved_files)}",
            ]
        ),
        encoding="utf-8",
    )

    if not p["xlsx"].exists():
        raise HTTPException(status_code=500, detail="Analysis did not generate workbook.")

    return {
        "analysis_id": analysis_id,
        "status": metadata["status"],
        "xlsx_url": f"/download/{analysis_id}/xlsx",
        "json_url": f"/download/{analysis_id}/json",
        "final_url": f"/download/{analysis_id}/final",
    }


@app.get("/status/{analysis_id}")
def status(analysis_id: str) -> dict:
    p = _run_paths(analysis_id)
    if not p["meta"].exists():
        raise HTTPException(status_code=404, detail="Unknown analysis_id.")
    return json.loads(p["meta"].read_text(encoding="utf-8"))


@app.get("/download/{analysis_id}/{artifact}")
def download(analysis_id: str, artifact: str) -> FileResponse:
    p = _run_paths(analysis_id)
    files = {
        "xlsx": (p["xlsx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "json": (p["json"], "application/json"),
        "final": (p["final"], "text/plain"),
    }
    if artifact not in files:
        raise HTTPException(status_code=400, detail="artifact must be one of: xlsx, json, final")

    target, media_type = files[artifact]
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"{artifact} not found for analysis_id={analysis_id}")

    return FileResponse(path=target, media_type=media_type, filename=target.name)
