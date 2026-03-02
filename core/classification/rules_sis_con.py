from __future__ import annotations

from core.classification.rules_base import RuleContext, set_classification
from core.canonical_models import CanonicalTransaction
from core.party_extract_regex import extract_party


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    markers = ["TR/CHEPA", "EBANK/TR TO", "EBANK/TR FROM", "TR TO", "TR FROM", "TRF"]
    if not any(m in txn.narration_norm for m in markers):
        return False

    party = extract_party(txn.narration_norm).party or txn.category_clean
    p = (party or "").upper().strip()
    if not p:
        return False

    account_ref = ctx.sister_entities.get(p) or ctx.account_entities.get(p)
    if not account_ref:
        # approximate match against known sister aliases
        for key, value in {**ctx.sister_entities, **ctx.account_entities}.items():
            if key in p or p in key:
                account_ref = value
                p = key
                break

    if not account_ref:
        return False

    set_classification(
        txn,
        type_code="SIS CON",
        category=f"{p}-{account_ref}",
        rule_id="SIS_CON_TRANSFER",
        confidence="HIGH",
        matched_tokens=["TR/CHEPA"],
    )
    return True
