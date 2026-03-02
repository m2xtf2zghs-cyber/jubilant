from __future__ import annotations

from core.classification.rules_base import RuleContext, set_classification
from core.canonical_models import CanonicalTransaction


def apply_purchase(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    if txn.dr_amount <= 0:
        return False
    category = (txn.category_clean or "").upper() or "PURCHASE"
    if category in {"DOUBT", "RETURN", "BANK FIN", "CASH WITHDRAWAL", "CASH DEPOSIT"}:
        return False
    set_classification(
        txn,
        type_code="PURCHASE",
        category=category,
        rule_id="PURCHASE_REMAINDER",
        confidence="MEDIUM",
        matched_tokens=["REMAINING_DEBIT"],
    )
    return True


def apply_sales(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    if txn.cr_amount <= 0:
        return False
    category = (txn.category_clean or "").upper() or "SALES"
    if category in {"DOUBT", "RETURN", "BANK FIN", "CASH WITHDRAWAL", "CASH DEPOSIT"}:
        return False
    set_classification(
        txn,
        type_code="SALES",
        category=category,
        rule_id="SALES_REMAINDER",
        confidence="MEDIUM",
        matched_tokens=["REMAINING_CREDIT"],
    )
    return True
