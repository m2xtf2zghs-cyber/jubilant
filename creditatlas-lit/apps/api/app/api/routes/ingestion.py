from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_current_auth
from app.db.session import get_db
from app.models.entities import LoanCase, VendorPayload
from app.schemas.common import (
    FinboxIngestionRequest,
    IngestionStatusOut,
    ReprocessResponse,
)
from app.services.audit import log_audit
from app.services.queue import enqueue_finbox_ingestion

router = APIRouter(prefix="/cases/{case_id}/bank-ingestion", tags=["bank-ingestion"])


@router.post("/finbox", response_model=IngestionStatusOut)
def ingest_finbox(
    case_id: str,
    payload: FinboxIngestionRequest,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> IngestionStatusOut:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == auth.org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    existing = db.scalar(
        select(VendorPayload)
        .where(VendorPayload.case_id == case_id)
        .where(VendorPayload.provider_name == "FINBOX")
        .where(VendorPayload.payload_type == "BANK_STATEMENT")
        .where(VendorPayload.external_reference == payload.external_reference)
    )

    if existing:
        queue_status = enqueue_finbox_ingestion(existing.id, auth.user.id)
        if existing.status == "PROCESSED" and queue_status == "QUEUED":
            existing.status = "QUEUED"
            db.commit()
            db.refresh(existing)
        return IngestionStatusOut(
            payload_id=existing.id,
            external_reference=existing.external_reference,
            status=existing.status,
            error_message=existing.error_message,
            updated_at=existing.updated_at,
        )

    row = VendorPayload(
        org_id=auth.org_id,
        case_id=case_id,
        provider_name="FINBOX",
        payload_type="BANK_STATEMENT",
        external_reference=payload.external_reference,
        payload=payload.payload,
        status="QUEUED",
    )
    db.add(row)
    db.flush()
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="BANK_INGESTION_REQUESTED",
        entity_type="vendor_payload",
        entity_id=row.id,
        details={"provider": "FINBOX", "external_reference": payload.external_reference},
    )
    db.commit()
    db.refresh(row)

    queue_status = enqueue_finbox_ingestion(row.id, auth.user.id)
    if queue_status == "PROCESSED_INLINE":
        db.refresh(row)

    return IngestionStatusOut(
        payload_id=row.id,
        external_reference=row.external_reference,
        status=row.status,
        error_message=row.error_message,
        updated_at=row.updated_at,
    )


@router.get("/status", response_model=IngestionStatusOut)
def ingestion_status(
    case_id: str,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> IngestionStatusOut:
    row = db.scalar(
        select(VendorPayload)
        .where(VendorPayload.case_id == case_id)
        .where(VendorPayload.org_id == auth.org_id)
        .order_by(VendorPayload.created_at.desc())
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ingestion found")

    return IngestionStatusOut(
        payload_id=row.id,
        external_reference=row.external_reference,
        status=row.status,
        error_message=row.error_message,
        updated_at=row.updated_at,
    )


@router.post("/reprocess", response_model=ReprocessResponse)
def reprocess(
    case_id: str,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> ReprocessResponse:
    row = db.scalar(
        select(VendorPayload)
        .where(VendorPayload.case_id == case_id)
        .where(VendorPayload.org_id == auth.org_id)
        .order_by(VendorPayload.created_at.desc())
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No payload found")

    row.status = "QUEUED"
    row.error_message = None
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="BANK_INGESTION_REPROCESS_REQUESTED",
        entity_type="vendor_payload",
        entity_id=row.id,
        details={"provider": row.provider_name, "external_reference": row.external_reference},
    )
    db.commit()

    queue_status = enqueue_finbox_ingestion(row.id, auth.user.id)
    if queue_status == "PROCESSED_INLINE":
        db.refresh(row)

    return ReprocessResponse(payload_id=row.id, status=row.status)
