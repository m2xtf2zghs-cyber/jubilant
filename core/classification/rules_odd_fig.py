from __future__ import annotations

from core.classification.rules_base import RuleContext, is_round_credit, set_classification
from core.canonical_models import CanonicalTransaction


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    if txn.cr_amount <= 0:
        return False

    cfg = ctx.config.get("round_figure", {})
    bases = tuple(int(x) for x in cfg.get("multiple_of_bases", [100000]))
    min_amount = float(cfg.get("min_amount_rupees", 100000))

    if not is_round_credit(txn, bases, min_amount):
        return False

    party = (txn.category_clean or "").upper()
    stats = ctx.party_stats.get(party)
    is_confirmed = party in ctx.confirmed_buyers and stats is not None and not stats.bidirectional

    if is_confirmed:
        return False

    flags = ["ROUND_FIGURE"]
    if stats is not None and stats.bidirectional:
        flags.append("BIDIRECTIONAL")

    set_classification(
        txn,
        type_code="ODD FIG",
        category=party or "ODD FIG",
        rule_id="ODD_FIG_ROUND_CREDIT",
        confidence="MEDIUM",
        matched_tokens=["ROUND_CREDIT"],
        add_flags=flags,
    )
    return True
