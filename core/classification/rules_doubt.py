from __future__ import annotations

from core.classification.rules_base import RuleContext, kw_hit, set_classification
from core.canonical_models import CanonicalTransaction


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    words = list(ctx.config.get("keywords", {}).get("doubt_explicit", []))
    hits = kw_hit(txn.narration_norm, words)
    if not hits:
        return False

    txt = txn.narration_norm
    category = "DOUBT"
    if "GST_REFUND" in txt or "GST REFUND" in txt:
        category = "GST REFUND"
    elif "ITDTAX REFUND" in txt or "INCOME TAX REFUND" in txt:
        category = "ITDTAX REFUND"
    elif "BUILDING APPROVAL" in txt or "APPROVAL" in txt:
        category = "BUILDING APPROVAL"

    set_classification(
        txn,
        type_code="DOUBT",
        category=category,
        rule_id="DOUBT_EXPLICIT",
        confidence="HIGH",
        matched_tokens=hits,
    )
    return True
