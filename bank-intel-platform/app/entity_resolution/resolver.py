from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.party_alias import PartyAlias

try:
    from rapidfuzz import fuzz
except Exception:  # pragma: no cover - optional dependency fallback
    fuzz = None


class EntityResolver:
    def __init__(self, db: Session):
        self.db = db

    def resolve(self, party: str | None) -> str | None:
        if not party:
            return None
        up = party.strip().upper()

        exact = self.db.query(PartyAlias).filter(PartyAlias.alias_name == up).first()
        if exact:
            return exact.normalized_name

        if fuzz is None:
            return up

        candidates = self.db.query(PartyAlias).all()
        best_name = None
        best_score = 0.0
        for c in candidates:
            score = fuzz.ratio(up, c.alias_name)
            if score > best_score:
                best_score = score
                best_name = c.normalized_name

        if best_score >= 90:
            return best_name
        return up
