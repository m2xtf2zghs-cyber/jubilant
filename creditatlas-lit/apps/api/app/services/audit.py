from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import AuditLog


def log_audit(
    db: Session,
    *,
    org_id: str,
    user_id: str | None,
    case_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict,
) -> None:
    db.add(
        AuditLog(
            org_id=org_id,
            user_id=user_id,
            case_id=case_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
    )
