from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.party_alias import PartyAlias

router = APIRouter(prefix="/aliases", tags=["aliases"])


class AliasMergeRequest(BaseModel):
    alias_name: str
    normalized_name: str


@router.post("/merge")
def merge_alias(payload: AliasMergeRequest, db: Session = Depends(db_session)) -> dict[str, str]:
    alias = payload.alias_name.strip().upper()
    normalized = payload.normalized_name.strip().upper()
    row = db.query(PartyAlias).filter(PartyAlias.alias_name == alias).first()
    if row is None:
        row = PartyAlias(alias_name=alias, normalized_name=normalized, source="ANALYST")
        db.add(row)
    else:
        row.normalized_name = normalized
    db.commit()
    return {"alias_name": alias, "normalized_name": normalized}
