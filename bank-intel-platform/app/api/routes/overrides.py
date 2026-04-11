from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.schemas.override import OverrideRequest, OverrideResponse
from app.services.override_service import OverrideService

router = APIRouter(prefix="/overrides", tags=["overrides"])


@router.post("/{job_id}", response_model=OverrideResponse)
def apply_override(job_id: str, payload: OverrideRequest, db: Session = Depends(db_session)) -> OverrideResponse:
    try:
        ov = OverrideService(db).apply(job_id=job_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return OverrideResponse.model_validate(ov)
