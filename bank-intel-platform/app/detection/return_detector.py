from __future__ import annotations

from app.core.domain import CanonicalTransaction


class ReturnDetector:
    def tag(self, txn: CanonicalTransaction) -> None:
        n = txn.cleaned_narration
        if any(k in n for k in ("RETURN", "RTGSRET", "BOUNCE", "CHQ RET", "REVERSAL")):
            txn.return_flag = True
            if txn.classification_primary == "UNKNOWN":
                txn.classification_primary = "RETURN"
