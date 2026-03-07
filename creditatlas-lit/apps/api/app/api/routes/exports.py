from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_analyst_auth
from app.db.session import get_db
from app.services.audit import log_audit
from app.services.export import (
    ExportBuildError,
    build_case_export_payload,
    render_case_excel,
    render_case_pdf,
)

router = APIRouter(prefix="/cases/{case_id}/export", tags=["exports"])


@router.get("/json")
def export_json(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> dict:
    try:
        payload = build_case_export_payload(db, org_id=auth.org_id, case_id=case_id)
    except ExportBuildError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="CASE_EXPORT_JSON",
        entity_type="loan_case",
        entity_id=case_id,
        details={"format": "json"},
    )
    db.commit()
    return payload


@router.get("/pdf")
def export_pdf(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> Response:
    try:
        payload = build_case_export_payload(db, org_id=auth.org_id, case_id=case_id)
    except ExportBuildError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    pdf_bytes = render_case_pdf(payload)
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="CASE_EXPORT_PDF",
        entity_type="loan_case",
        entity_id=case_id,
        details={"format": "pdf"},
    )
    db.commit()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="case-{case_id}.pdf"'},
    )


@router.get("/excel")
def export_excel(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> Response:
    try:
        payload = build_case_export_payload(db, org_id=auth.org_id, case_id=case_id)
    except ExportBuildError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    excel_bytes = render_case_excel(payload)
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case_id,
        action="CASE_EXPORT_EXCEL",
        entity_type="loan_case",
        entity_id=case_id,
        details={"format": "excel"},
    )
    db.commit()

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="case-{case_id}.xlsx"'},
    )
