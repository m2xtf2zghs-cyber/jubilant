from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_analyst_auth
from app.db.session import get_db
from app.models.entities import GstProfile, LoanCase
from app.schemas.common import GSTProfileOut, GSTVerifyRequest
from app.services.gst import GSTProviderError, sync_case_gst_profile

router = APIRouter(prefix="/cases/{case_id}/gst", tags=["gst"])


@router.post("/verify", response_model=GSTProfileOut)
def verify_gst_for_case(
    case_id: str,
    payload: GSTVerifyRequest,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> GSTProfileOut:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == auth.org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    try:
        profile = sync_case_gst_profile(
            db,
            org_id=auth.org_id,
            case_id=case_id,
            gstin=payload.gstin,
            user_id=auth.user.id,
        )
        db.commit()
        db.refresh(profile)
        return GSTProfileOut.model_validate(profile)
    except GSTProviderError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/profile", response_model=GSTProfileOut)
def get_gst_profile(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> GSTProfileOut:
    profile = db.scalar(
        select(GstProfile).where(GstProfile.case_id == case_id, GstProfile.org_id == auth.org_id)
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GST profile not found")

    return GSTProfileOut.model_validate(profile)
