from __future__ import annotations

from datetime import date

from core.canonical_models import CanonicalTransaction
from excel.pivot_builder import build_pivot_table


def _txn(i: int, month: str, typ: str, dr: float, cr: float) -> CanonicalTransaction:
    m_map = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
    return CanonicalTransaction(
        txn_uid=f"u{i}",
        source_file="f.pdf",
        source_page=1,
        source_line=i,
        statement_order=i,
        bank_name="TMB",
        account_holder="A",
        account_no_masked="XXXX1",
        account_type="CA",
        account_id="TMB-0001-CA",
        txn_date=date(2025, m_map[month], 1),
        month_label=month,
        narration_raw="N",
        narration_norm="N",
        cheque_no=None,
        ref_no=None,
        utr=None,
        dr_amount=dr,
        cr_amount=cr,
        balance=None,
        channel="OTHER",
        type_code=typ,
        category_clean="CAT",
        rule_id="R",
        confidence="HIGH",
        matched_tokens=[],
        flags=[],
    )


def test_pivot_grand_totals_match_xns_totals():
    txns = [
        _txn(1, "AUG", "PURCHASE", 100000.0, 0.0),
        _txn(2, "AUG", "SALES", 0.0, 250000.0),
        _txn(3, "SEP", "PURCHASE", 50000.0, 0.0),
        _txn(4, "SEP", "SALES", 0.0, 125000.0),
    ]
    table = build_pivot_table(txns)
    grand = table["grand"]

    assert round(float(grand["TOTAL_DR"]), 8) == round(float(table["xns_total_dr"]), 8)
    assert round(float(grand["TOTAL_CR"]), 8) == round(float(table["xns_total_cr"]), 8)
