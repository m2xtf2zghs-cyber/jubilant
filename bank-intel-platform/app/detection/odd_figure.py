from __future__ import annotations

from app.core.domain import CanonicalTransaction
from app.utils.money import is_round_figure


class OddFigureDetector:
    def tag(self, txn: CanonicalTransaction) -> None:
        if txn.credit > 0 and txn.credit >= 100000 and is_round_figure(txn.credit):
            txn.odd_figure_flag = True
            if txn.classification_primary == "UNKNOWN":
                txn.classification_primary = "ODD FIG"
