from __future__ import annotations

from collections import defaultdict
from typing import Any

import core.classification.rules_bank_fin as rules_bank_fin
import core.classification.rules_cash as rules_cash
import core.classification.rules_doubt as rules_doubt
import core.classification.rules_expense as rules_expense
import core.classification.rules_insurance as rules_insurance
import core.classification.rules_odd_fig as rules_odd_fig
import core.classification.rules_purchase_sales as rules_purchase_sales
import core.classification.rules_pvt_fin as rules_pvt_fin
import core.classification.rules_return as rules_return
import core.classification.rules_sis_con as rules_sis_con
from core.classification.rules_base import PartyStats, RuleContext, set_classification
from core.canonical_models import CanonicalTransaction


def _is_round(amount: float, base: int = 100000) -> bool:
    return amount > 0 and int(round(amount)) % base == 0


def build_party_stats(transactions: list[CanonicalTransaction]) -> dict[str, PartyStats]:
    stats: dict[str, PartyStats] = defaultdict(PartyStats)
    for txn in transactions:
        party = (txn.category_clean or "").upper().strip()
        if not party or party == "DOUBT":
            continue
        st = stats[party]
        if txn.dr_amount > 0:
            st.debit_total += txn.dr_amount
            st.debit_months.add(txn.month_label)
            st.debit_amounts.append(txn.dr_amount)
        if txn.cr_amount > 0:
            st.credit_total += txn.cr_amount
            st.credit_months.add(txn.month_label)
            st.credit_amounts.append(txn.cr_amount)
    return dict(stats)


def build_confirmed_buyers(transactions: list[CanonicalTransaction], stats: dict[str, PartyStats]) -> set[str]:
    out: set[str] = set()
    by_party: dict[str, list[CanonicalTransaction]] = defaultdict(list)
    for txn in transactions:
        p = (txn.category_clean or "").upper().strip()
        if p:
            by_party[p].append(txn)

    for party, txns in by_party.items():
        st = stats.get(party)
        if not st or st.bidirectional:
            continue
        odd_credits = [t for t in txns if t.cr_amount > 0 and not _is_round(t.cr_amount)]
        if len(odd_credits) >= 2:
            out.add(party)
    return out


def classify_transactions(
    transactions: list[CanonicalTransaction],
    *,
    config: dict[str, Any],
    account_entities: dict[str, str] | None = None,
    sister_entities: dict[str, str] | None = None,
) -> list[CanonicalTransaction]:
    account_entities = account_entities or {}
    sister_entities = sister_entities or {}

    party_stats = build_party_stats(transactions)
    confirmed_buyers = build_confirmed_buyers(transactions, party_stats)

    ctx = RuleContext(
        config=config,
        party_stats=party_stats,
        account_entities=account_entities,
        sister_entities=sister_entities,
        confirmed_buyers=confirmed_buyers,
    )

    # strict order
    for txn in transactions:
        if rules_bank_fin.apply(txn, ctx):
            continue
        if rules_return.apply(txn, ctx):
            continue
        if rules_cash.apply(txn, ctx):
            continue
        if rules_sis_con.apply(txn, ctx):
            continue
        if rules_insurance.apply(txn, ctx):
            continue
        if rules_expense.apply(txn, ctx):
            continue
        if rules_doubt.apply(txn, ctx):
            continue
        if rules_pvt_fin.apply(txn, ctx):
            continue
        if rules_odd_fig.apply(txn, ctx):
            continue
        if rules_purchase_sales.apply_purchase(txn, ctx):
            continue
        if rules_purchase_sales.apply_sales(txn, ctx):
            continue

        # fallback
        set_classification(
            txn,
            type_code="DOUBT",
            category=txn.category_clean or "DOUBT",
            rule_id="FALLBACK_DOUBT",
            confidence="LOW",
            matched_tokens=["AUTO"],
            add_flags=["AUTO-UNCLASSIFIED"],
        )

    # optional post reclass: if party is bidirectional, prefer PVT FIN over ODD FIG credits
    reclass_if_bidir = bool(config.get("pvt_finance", {}).get("bidirectional_party_triggers_pvt", True))
    if reclass_if_bidir:
        for txn in transactions:
            if txn.type_code != "ODD FIG":
                continue
            st = party_stats.get((txn.category_clean or "").upper(), PartyStats())
            if st.bidirectional:
                set_classification(
                    txn,
                    type_code="PVT FIN",
                    category=txn.category_clean,
                    rule_id="PVT_FIN_BIDIR_RECLASS",
                    confidence="MEDIUM",
                    matched_tokens=["BIDIRECTIONAL"],
                    add_flags=["BIDIRECTIONAL"],
                )

    return transactions
