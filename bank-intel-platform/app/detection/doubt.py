from __future__ import annotations

from app.core.domain import CanonicalTransaction


class DoubtDetector:
    def tag(self, txn: CanonicalTransaction) -> None:
        if txn.classification_primary == "UNKNOWN" or txn.confidence_score < 0.5:
            txn.doubt_flag = True
            if txn.classification_primary == "UNKNOWN":
                txn.classification_primary = "DOUBT"
