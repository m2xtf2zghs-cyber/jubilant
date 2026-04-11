from __future__ import annotations

from app.core.domain import CanonicalTransaction, DetectionResult


class BankFinanceDetector:
    def run(self, txn: CanonicalTransaction) -> DetectionResult:
        n = txn.cleaned_narration
        hit = any(k in n for k in ("EMI", "ECS", "NACH", "LOAN", "INT.COLL", "PENAL"))
        return DetectionResult(code="BANK_FIN", flag=hit, reason="Narration indicates formal lender servicing", confidence=0.85 if hit else 0.4)
