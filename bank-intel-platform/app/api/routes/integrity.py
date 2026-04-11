from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import app_settings
from app.core.settings import Settings
from app.integrity import PdfIntegrityAnalyzer
from app.schemas.parse import IntegritySignalResponse, PdfIntegrityResponse
from app.utils.uploads import UploadValidationError, validate_pdf_bytes, validate_upload_count

router = APIRouter(prefix="/integrity", tags=["integrity"])


def _serialize_result(result) -> PdfIntegrityResponse:
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


@router.post("/check", response_model=list[PdfIntegrityResponse])
async def check_integrity(
    files: list[UploadFile] = File(...),
    settings: Settings = Depends(app_settings),
) -> list[PdfIntegrityResponse]:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")
    try:
        validate_upload_count(len(files), settings)
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analyzer = PdfIntegrityAnalyzer()
    results: list[PdfIntegrityResponse] = []
    for upload in files:
        try:
            validated = validate_pdf_bytes(upload.filename or "statement.pdf", await upload.read(), settings)
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp:
            temp.write(validated.content)
            temp.flush()
            temp_path = temp.name
        try:
            results.append(_serialize_result(analyzer.analyze(temp_path)))
        finally:
            Path(temp_path).unlink(missing_ok=True)
    return results
