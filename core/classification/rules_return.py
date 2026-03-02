from __future__ import annotations

from core.classification.rules_base import RuleContext, kw_hit, set_classification
from core.canonical_models import CanonicalTransaction
from core.party_extract_regex import extract_party


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    keywords = list(ctx.config.get("keywords", {}).get("returns", []))
    hits = kw_hit(txn.narration_norm, keywords)
    if not hits:
        return False

    party = extract_party(txn.narration_norm).party
    if not party and "/" in txn.narration_norm:
        parts = [p.strip() for p in txn.narration_norm.split("/") if p.strip()]
        if len(parts) >= 2:
            party = parts[1]
    if party and (party.isdigit() or len([c for c in party if c.isalpha()]) < 3):
        party = None
    category = party or "RETURN"
    flags = []
    if "NOT REP" in txn.narration_norm:
        flags.append("NOT_REP")
    set_classification(
        txn,
        type_code="RETURN",
        category=category,
        rule_id="RETURN_KEYWORD",
        confidence="HIGH",
        matched_tokens=hits,
        add_flags=flags,
    )
    return True
