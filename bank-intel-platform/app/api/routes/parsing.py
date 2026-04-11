from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import app_settings, db_session
from app.core.settings import Settings
from app.integrity import PdfIntegrityAnalyzer
from app.models.source_file import SourceFile
from app.schemas.parse import IntegritySignalResponse, ParseJobResponse, PdfIntegrityResponse
from app.services.job_service import JobService
from app.services.parsing_service import ParsingService
from app.utils.uploads import (
    UploadValidationError,
    allocate_upload_path,
    prepare_upload_dir,
    validate_pdf_bytes,
    validate_upload_count,
)

router = APIRouter(prefix="/parse", tags=["parsing"])


def _serialize_integrity(result) -> PdfIntegrityResponse:
    return PdfIntegrityResponse(
        file_name=result.file_name,
        verdict=result.verdict,
        score=result.score,
        confidence=result.confidence,
        summary=result.summary,
        page_count=result.page_count,
        text_page_count=result.text_page_count,
        image_only_page_count=result.image_only_page_count,
        is_encrypted=result.is_encrypted,
        has_digital_signature=result.has_digital_signature,
        has_incremental_updates=result.has_incremental_updates,
        creator=result.creator,
        producer=result.producer,
        creation_date=result.creation_date,
        mod_date=result.mod_date,
        signals=[IntegritySignalResponse(code=s.code, severity=s.severity, message=s.message) for s in result.signals],
    )


@router.post("/upload", response_model=ParseJobResponse)
async def upload_and_parse(
    files: list[UploadFile] = File(...),
    job_name: str = Form("Statement Parse Job"),
    borrower_rules_yaml: str | None = Form(None),
    db: Session = Depends(db_session),
    settings: Settings = Depends(app_settings),
) -> ParseJobResponse:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")
    try:
        validate_upload_count(len(files), settings)
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stored: list[tuple[str, str]] = []
    integrity_results: list[PdfIntegrityResponse] = []
    analyzer = PdfIntegrityAnalyzer()
    upload_dir = prepare_upload_dir(settings.upload_path, f"upload-{uuid.uuid4().hex}")
    for index, up in enumerate(files, start=1):
        try:
            validated = validate_pdf_bytes(up.filename or "statement.pdf", await up.read(), settings)
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        target = allocate_upload_path(upload_dir, index, validated.safe_name)
        target.write_bytes(validated.content)
        stored.append((validated.original_name, str(target.resolve())))
        integrity_results.append(_serialize_integrity(analyzer.analyze(str(target.resolve()))))

    job = JobService(db).create_job(job_name, stored, notes=borrower_rules_yaml)
    ParsingService(db, settings.config_path).parse_job(job.id)
    return ParseJobResponse(job_id=job.id, status="PARSED", files=[f for f, _ in stored], integrity_results=integrity_results)


@router.post("/{job_id}", response_model=ParseJobResponse)
def parse_existing_job(job_id: str, db: Session = Depends(db_session), settings: Settings = Depends(app_settings)) -> ParseJobResponse:
    job = JobService(db).get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    files = db.query(SourceFile).filter(SourceFile.job_id == job_id).all()
    if not files:
        raise HTTPException(status_code=400, detail="job has no source files")

    ParsingService(db, settings.config_path).parse_job(job_id)
    analyzer = PdfIntegrityAnalyzer()
    integrity_results = [_serialize_integrity(analyzer.analyze(f.stored_path)) for f in files]
    return ParseJobResponse(
        job_id=job_id,
        status="PARSED",
        files=[Path(f.stored_path).name for f in files],
        integrity_results=integrity_results,
    )
