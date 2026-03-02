from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from core.canonical_models import CanonicalTransaction


@dataclass
class PartyStats:
    debit_total: float = 0.0
    credit_total: float = 0.0
    debit_months: set[str] = field(default_factory=set)
    credit_months: set[str] = field(default_factory=set)
    debit_amounts: list[float] = field(default_factory=list)
    credit_amounts: list[float] = field(default_factory=list)

    @property
    def bidirectional(self) -> bool:
        return self.debit_total > 0 and self.credit_total > 0


@dataclass
class RuleContext:
    config: dict[str, Any]
    party_stats: dict[str, PartyStats]
    account_entities: dict[str, str]
    sister_entities: dict[str, str]
    confirmed_buyers: set[str]


def kw_hit(text: str, keywords: list[str]) -> list[str]:
    up = text.upper()
    hits = [k for k in keywords if k.upper() in up]
    return hits


def is_round_credit(txn: CanonicalTransaction, bases: tuple[int, ...], min_amount: float) -> bool:
    if txn.cr_amount <= 0 or txn.cr_amount < min_amount:
        return False
    amt = int(round(txn.cr_amount))
    return any(b > 0 and amt % b == 0 for b in bases)


def set_classification(
    txn: CanonicalTransaction,
    *,
    type_code: str,
    category: str,
    rule_id: str,
    confidence: str,
    matched_tokens: list[str] | None = None,
    add_flags: list[str] | None = None,
) -> None:
    txn.type_code = type_code
    txn.category_clean = category or type_code
    txn.rule_id = rule_id
    txn.confidence = confidence
    txn.matched_tokens = matched_tokens or []
    if add_flags:
        for flag in add_flags:
            if flag not in txn.flags:
                txn.flags.append(flag)
