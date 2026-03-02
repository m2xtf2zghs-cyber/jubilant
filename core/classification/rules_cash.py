from __future__ import annotations

from core.classification.rules_base import RuleContext, set_classification
from core.canonical_models import CanonicalTransaction


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    if "TR/CHEPA" in txn.narration_norm and "CS/CHEPA" not in txn.narration_norm:
        return False

    words = [str(x).upper() for x in ctx.config.get("channels", {}).get("cash_keywords", ["CASH", "ATM", "CS/", "CHEPA", "SELF", "CD/"])]
    hits = [w for w in words if w in txn.narration_norm]
    if not hits:
        return False

    category = "CASH WITHDRAWAL" if txn.dr_amount > 0 else "CASH DEPOSIT"
    flags = []
    if "CS/CHEPA/" in txn.narration_norm and "SELF" not in txn.narration_norm:
        flags.append("CASH_TO_PERSON")
    set_classification(
        txn,
        type_code="CASH",
        category=category,
        rule_id="CASH_PATTERN",
        confidence="HIGH",
        matched_tokens=hits,
        add_flags=flags,
    )
    return True
