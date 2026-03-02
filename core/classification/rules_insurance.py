from __future__ import annotations

from core.classification.rules_base import RuleContext, kw_hit, set_classification
from core.canonical_models import CanonicalTransaction


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    words = list(ctx.config.get("keywords", {}).get("insurance", []))
    hits = kw_hit(txn.narration_norm, words)
    if not hits:
        return False
    set_classification(
        txn,
        type_code="INSURANCE",
        category="INSURANCE",
        rule_id="INSURANCE_KEYWORD",
        confidence="HIGH",
        matched_tokens=hits,
    )
    return True
