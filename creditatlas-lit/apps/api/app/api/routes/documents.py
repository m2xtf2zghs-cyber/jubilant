from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_current_auth
from app.db.session import get_db
from app.models.entities import Document, LoanCase
from app.schemas.common import DocumentOut
from app.services.audit import log_audit
from app.services.storage import storage

router = APIRouter(prefix="/cases/{case_id}/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    case_id: str,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> DocumentOut:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == auth.org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    storage.ensure_bucket()

    content = await file.read()
    object_key = f"org/{auth.org_id}/case/{case_id}/{uuid.uuid4()}-{file.filename}"
    storage.upload_bytes(object_key, content, file.content_type)

    doc = Document(
        org_id=auth.org_id,
        case_id=case_id,
        file_name=file.filename,
        object_key=object_key,
        content_type=file.content_type,
        size_bytes=len(content),
        uploaded_by=auth.user.id,
    )
    db.add(doc)
    db.flush()
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="DOCUMENT_UPLOADED",
        entity_type="document",
        entity_id=doc.id,
        details={"file_name": file.filename, "object_key": object_key, "size_bytes": len(content)},
    )
    db.commit()
    db.refresh(doc)

    return DocumentOut.model_validate(doc)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    case_id: str,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == auth.org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    rows = db.scalars(
        select(Document)
        .where(Document.case_id == case_id)
        .where(Document.org_id == auth.org_id)
        .order_by(Document.created_at.desc())
    ).all()
    return [DocumentOut.model_validate(row) for row in rows]
