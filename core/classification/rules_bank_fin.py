from __future__ import annotations

from core.classification.rules_base import RuleContext, kw_hit, set_classification
from core.canonical_models import CanonicalTransaction
from core.party_extract_regex import BILL_ID, JL_DISP, LOAN_COLL


def apply(txn: CanonicalTransaction, ctx: RuleContext) -> bool:
    keywords = list(ctx.config.get("keywords", {}).get("bank_finance", []))
    hits = kw_hit(txn.narration_norm, keywords)

    m_loan = LOAN_COLL.search(txn.narration_norm)
    if m_loan:
        loan = m_loan.group("loan")
        set_classification(
            txn,
            type_code="BANK FIN",
            category=f"Loan -{loan[-4:]}",
            rule_id="BANK_FIN_LOAN_COLL",
            confidence="HIGH",
            matched_tokens=["LOAN COLL"],
            add_flags=["OD_CC"] if txn.account_type in {"OD", "CC"} else [],
        )
        return True

    m_jl = JL_DISP.search(txn.narration_norm)
    if m_jl:
        loan = m_jl.group("loan")
        set_classification(
            txn,
            type_code="BANK FIN",
            category=f"Gold Loan Disbursed -{loan[-4:]}",
            rule_id="BANK_FIN_JL_DISP",
            confidence="HIGH",
            matched_tokens=["JL DISP"],
        )
        return True

    m_bill = BILL_ID.search(txn.narration_norm)
    if m_bill:
        bill = m_bill.group("bill")
        set_classification(
            txn,
            type_code="BANK FIN",
            category=f"Bill Id -{bill}",
            rule_id="BANK_FIN_BILL_ID",
            confidence="HIGH",
            matched_tokens=["BILL ID"],
            add_flags=["DP_BILL"],
        )
        return True

    if "INT.COLL" in txn.narration_norm or "INT COLL" in txn.narration_norm or "INTEREST COLLECTION" in txn.narration_norm:
        set_classification(
            txn,
            type_code="BANK FIN",
            category="Interest Charges",
            rule_id="BANK_FIN_INT_COLL",
            confidence="HIGH",
            matched_tokens=["INT.COLL"],
            add_flags=["OD_INTEREST"] if txn.account_type in {"OD", "CC"} else [],
        )
        return True

    if hits:
        set_classification(
            txn,
            type_code="BANK FIN",
            category="BANK FIN",
            rule_id="BANK_FIN_KEYWORD",
            confidence="HIGH",
            matched_tokens=hits,
            add_flags=["OD_CC"] if txn.account_type in {"OD", "CC"} else [],
        )
        return True

    return False
