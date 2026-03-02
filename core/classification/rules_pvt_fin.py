from __future__ import annotations

from core.classification.rules_base import PartyStats, RuleContext, set_classification
from core.canonical_models import CanonicalTransaction


def _is_individual_name(name: str) -> bool:
    if not name:
        return False
    # basic heuristic: <=3 tokens and no common corp markers
    corp = ["PVT", "LTD", "LIMITED", "INDUSTRIES", "ENTERPRISE", "TRADERS", "BUSINESS", "MOTHER"]
    up = name.upper()
    if any(c in up for c in corp):
        return False
    return len([t for t in up.split() if t]) <= 4


def _recurs(stats: PartyStats, months_min: int, tolerance_pct: float) -> bool:
    if len(stats.debit_months) < months_min or len(stats.debit_amounts) < months_min:
        return False
    avg = sum(stats.debit_amounts) / max(1, len(stats.debit_amounts))
    if avg <= 0:
        return False
    band = avg * (tolerance_pct / 100.0)
    similar = sum(1 for a in stats.debit_amounts if abs(a - avg) <= band)
    return similar >= months_min


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    party = (txn.category_clean or "").upper()
    if not party or party in {"DOUBT", "RETURN", "BANK FIN", "CASH WITHDRAWAL", "CASH DEPOSIT"}:
        return False

    cfg = ctx.config.get("pvt_finance", {})
    rec = cfg.get("recurrence", {})
    months_min = int(rec.get("months_min", 4))
    tolerance_pct = float(rec.get("amount_tolerance_pct", 5))
    large_thresh = float(cfg.get("large_individual_threshold_rupees", 500000))

    stats = ctx.party_stats.get(party, PartyStats())
    rec_hit = _recurs(stats, months_min, tolerance_pct)
    bidir = stats.bidirectional and _is_individual_name(party)
    large_round = (
        txn.cr_amount >= large_thresh
        and txn.cr_amount % 100000 == 0
        and _is_individual_name(party)
        and stats.debit_total > 0
    )

    if not (rec_hit or bidir or large_round):
        return False

    flags = []
    if bidir:
        flags.append("BIDIRECTIONAL")
    if rec_hit:
        flags.append("RECURRENCE")

    set_classification(
        txn,
        type_code="PVT FIN",
        category=party,
        rule_id="PVT_FIN_HEURISTIC",
        confidence="MEDIUM",
        matched_tokens=["PVT_HEURISTIC"],
        add_flags=flags,
    )
    return True
