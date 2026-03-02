from __future__ import annotations

from core.classification.rules_base import RuleContext, kw_hit, set_classification
from core.canonical_models import CanonicalTransaction


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    if "REFUND" in txn.narration_norm:
        return False

    words = list(ctx.config.get("keywords", {}).get("expense", []))
    hits = kw_hit(txn.narration_norm, words)
    if not hits:
        return False

    category = "EXPENSE"
    txt = txn.narration_norm
    if "CBDT" in txt:
        category = "CBDT TAX"
    elif "TIN/" in txt or "/TAX" in txt or " TAX" in txt or "GST" in txt:
        category = "TAX"
    elif "EB BILL" in txt or "ELECTRICITY" in txt:
        category = "EB BILL"
    elif "SALARY" in txt:
        category = "SALARY"

    set_classification(
        txn,
        type_code="EXPENSE",
        category=category,
        rule_id="EXPENSE_KEYWORD",
        confidence="HIGH",
        matched_tokens=hits,
    )
    return True
