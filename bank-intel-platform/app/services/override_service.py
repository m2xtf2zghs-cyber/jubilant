from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.analyst_override import AnalystOverride
from app.models.transaction import Transaction
from app.schemas.override import OverrideRequest


class OverrideService:
    def __init__(self, db: Session):
        self.db = db

    def apply(self, job_id: str, payload: OverrideRequest) -> AnalystOverride:
        txn = self.db.query(Transaction).filter(Transaction.id == payload.transaction_id, Transaction.job_id == job_id).first()
        if txn is None:
            raise ValueError("transaction not found")

        txn.classification_primary = payload.classification_primary.upper()
        txn.classification_secondary = payload.classification_secondary
        txn.normalized_party = payload.normalized_party or txn.normalized_party
        txn.analyst_notes = payload.analyst_notes
        txn.overridden_by_user = True

        ov = AnalystOverride(
            job_id=job_id,
            transaction_id=txn.id,
            classification_primary=txn.classification_primary,
            classification_secondary=txn.classification_secondary,
            normalized_party=txn.normalized_party,
            analyst_notes=txn.analyst_notes,
        )
        self.db.add(ov)
        self.db.commit()
        self.db.refresh(ov)
        return ov
