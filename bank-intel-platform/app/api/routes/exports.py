from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import app_settings, db_session
from app.core.settings import Settings
from app.schemas.export import ExportResponse
from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("/{job_id}", response_model=ExportResponse)
def export_workbook(job_id: str, db: Session = Depends(db_session), settings: Settings = Depends(app_settings)) -> ExportResponse:
    try:
        exported = ExportService(db, settings.export_path).export_job_workbook(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ExportResponse(job_id=job_id, export_id=exported.id, file_path=exported.file_path, status=exported.status.value)


@router.get("/{job_id}/latest")
def download_latest(job_id: str, db: Session = Depends(db_session)) -> FileResponse:
    from app.models.workbook_export import WorkbookExport

    row = (
        db.query(WorkbookExport)
        .filter(WorkbookExport.job_id == job_id)
        .order_by(WorkbookExport.created_at.desc())
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="no export found")
    file_path = Path(row.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="export file missing")
    return FileResponse(path=file_path, filename=file_path.name)
