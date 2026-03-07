from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_analyst_auth
from app.db.session import get_db
from app.models.entities import Borrower
from app.schemas.common import BorrowerCreate, BorrowerOut
from app.services.audit import log_audit

router = APIRouter(prefix="/borrowers", tags=["borrowers"])


@router.post("", response_model=BorrowerOut)
def create_borrower(
    payload: BorrowerCreate,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> BorrowerOut:
    borrower = Borrower(org_id=auth.org_id, **payload.model_dump())
    db.add(borrower)
    db.flush()
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=None,
        action="BORROWER_CREATED",
        entity_type="borrower",
        entity_id=borrower.id,
        details=payload.model_dump(),
    )
    db.commit()
    db.refresh(borrower)
    return BorrowerOut.model_validate(borrower)


@router.get("", response_model=list[BorrowerOut])
def list_borrowers(
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[BorrowerOut]:
    rows = db.scalars(
        select(Borrower)
        .where(Borrower.org_id == auth.org_id)
        .order_by(Borrower.created_at.desc())
    ).all()
    return [BorrowerOut.model_validate(row) for row in rows]


@router.get("/{borrower_id}", response_model=BorrowerOut)
def get_borrower(
    borrower_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> BorrowerOut:
    row = db.scalar(
        select(Borrower)
        .where(Borrower.id == borrower_id)
        .where(Borrower.org_id == auth.org_id)
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")
    return BorrowerOut.model_validate(row)
