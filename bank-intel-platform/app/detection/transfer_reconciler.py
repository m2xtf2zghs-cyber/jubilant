from __future__ import annotations

from app.core.domain import CanonicalTransaction


def _clean(value: str | None) -> str:
    return " ".join((value or "").upper().split()).strip()


def _amount(txn: CanonicalTransaction) -> float:
    if txn.credit > 0:
        return round(txn.credit, 2)
    return round(txn.debit, 2)


class TransferReconciler:
    VERIFIED_TYPE = {
        "UNMATCH SIS CON": "SIS CON",
        "UNMATCH INB TRF": "INB TRF",
    }

    def tag(self, txns: list[CanonicalTransaction]) -> None:
        for txn in txns:
            verified = self.VERIFIED_TYPE.get(txn.classification_primary)
            if not verified:
                continue
            match = self._find_counterpart(txn, txns)
            if match is None:
                continue
            txn.classification_primary = verified
            txn.confidence_score = max(txn.confidence_score, 0.95)
            if verified == "SIS CON":
                txn.sister_concern_flag = True
            sec = txn.classification_secondary or ""
            if "VERIFIED_MATCH" not in sec:
                txn.classification_secondary = (sec + "|VERIFIED_MATCH").strip("|")

    def _find_counterpart(
        self,
        txn: CanonicalTransaction,
        txns: list[CanonicalTransaction],
    ) -> CanonicalTransaction | None:
        party = _clean(txn.normalized_party or txn.inferred_party or txn.linked_entity)
        source_name = _clean(txn.source_account_name)
        amt = _amount(txn)
        if not party or amt <= 0:
            return None

        for other in txns:
            if other is txn:
                continue
            if other.source_account_no == txn.source_account_no and other.source_bank == txn.source_bank:
                continue
            if _amount(other) != amt:
                continue
            if txn.debit > 0 and other.credit <= 0:
                continue
            if txn.credit > 0 and other.debit <= 0:
                continue
            if txn.txn_date and other.txn_date and abs((txn.txn_date - other.txn_date).days) > 2:
                continue

            other_name = _clean(other.source_account_name)
            other_party = _clean(other.normalized_party or other.inferred_party or other.linked_entity)
            if party in {other_name, other_party}:
                return other
            if txn.classification_primary == "UNMATCH INB TRF" and source_name and source_name in {other_name, other_party}:
                return other
        return None
