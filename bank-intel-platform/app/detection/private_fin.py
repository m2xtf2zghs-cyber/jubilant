from __future__ import annotations

from collections import defaultdict

from app.core.domain import CanonicalTransaction
from app.utils.money import is_round_figure

BUSINESS_TOKENS = {
    "STEEL",
    "STEE",
    "METAL",
    "METALS",
    "ENTERPRISE",
    "ENTERPRISES",
    "INDUSTR",
    "AGENCY",
    "TRADER",
    "TRADERS",
    "PROPERTIES",
    "BUSINESS",
    "FINANCE",
    "MOTORS",
    "PETROLEUM",
    "LTD",
    "LIMITED",
    "PVT",
    "LLP",
    "ROADWAYS",
    "LOGISTICS",
}


HARD_TYPES = {
    "BANK FIN",
    "SIS CON",
    "UNMATCH SIS CON",
    "INB TRF",
    "UNMATCH INB TRF",
    "RETURN",
    "REVERSAL",
}


def _looks_business_like(name: str) -> bool:
    up = (name or "").upper()
    return any(token in up for token in BUSINESS_TOKENS)


class PrivateFinanceDetector:
    def tag(self, txns: list[CanonicalTransaction]) -> None:
        by_party: dict[str, list[CanonicalTransaction]] = defaultdict(list)
        for txn in txns:
            party = txn.normalized_party or txn.inferred_party
            if party and txn.classification_primary not in HARD_TYPES and not txn.sister_concern_flag:
                by_party[party].append(txn)

        for party, rows in by_party.items():
            if len(rows) < 3:
                continue
            if _looks_business_like(party):
                continue
            credits = [r for r in rows if r.credit > 0]
            debits = [r for r in rows if r.debit > 0]
            if not credits or len(debits) < 2:
                continue
            round_credits = [r for r in credits if is_round_figure(r.credit, base=1000) and r.credit >= 10000]
            if not round_credits:
                continue
            if len(round_credits) > 3:
                continue
            max_credit = max(r.credit for r in round_credits)
            smaller_debits = [r for r in debits if r.debit <= max_credit * 0.8]
            if len(smaller_debits) < 2:
                continue
            debit_amounts = {round(r.debit, 2) for r in smaller_debits}
            if len(debit_amounts) > max(3, len(smaller_debits) // 2):
                continue
            months = {r.month_key for r in rows if r.month_key and r.month_key != "UNKNOWN"}
            if len(months) < 2:
                continue
            dated_debits = sorted((r for r in smaller_debits if r.txn_date), key=lambda row: row.txn_date)
            if len(dated_debits) >= 3:
                intervals = [
                    (dated_debits[i + 1].txn_date - dated_debits[i].txn_date).days
                    for i in range(len(dated_debits) - 1)
                ]
                avg_interval = sum(intervals) / len(intervals)
                if not (5 <= avg_interval <= 45):
                    continue
                variance = sum((i - avg_interval) ** 2 for i in intervals) / len(intervals)
                if avg_interval and variance / (avg_interval**2) >= 0.5:
                    continue
            for r in rows:
                r.classification_primary = "PVT FIN"
                r.private_fin_flag = True
                sec = r.classification_secondary or ""
                if "PVT_LOOP" not in sec:
                    r.classification_secondary = (sec + "|PVT_LOOP").strip("|")
                r.confidence_score = max(r.confidence_score, 0.9)
