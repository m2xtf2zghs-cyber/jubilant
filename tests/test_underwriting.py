from __future__ import annotations

from datetime import date

from core.canonical_models import CanonicalTransaction
from core.underwriting_engine import apply_underwriting, build_account_context


def _txn(
    i: int,
    *,
    typ: str,
    dr: float = 0.0,
    cr: float = 0.0,
    month: int = 8,
    party: str = "PARTY",
    narr: str = "NARR",
) -> CanonicalTransaction:
    dt = date(2025, month, 10)
    return CanonicalTransaction(
        txn_uid=f"u{i}",
        source_file="f.pdf",
        source_page=1,
        source_line=i,
        statement_order=i,
        bank_name="TMB",
        account_holder="AFFAN METALS",
        account_no_masked="XXXXX5048",
        account_type="CA",
        account_id="TMB-5048-CA",
        txn_date=dt,
        month_label=dt.strftime("%b").upper(),
        narration_raw=narr,
        narration_norm=narr.upper(),
        cheque_no=None,
        ref_no=None,
        utr=None,
        dr_amount=dr,
        cr_amount=cr,
        balance=None,
        channel="OTHER",
        type_code=typ,
        category_clean=party,
        rule_id="R",
        confidence="HIGH",
        matched_tokens=[],
        flags=[],
    )


def test_round_credit_in_sales_sets_watch():
    txns = [_txn(1, typ="SALES", cr=100000.0, party="BUYER", narr="RTGS/BUYER/REF")]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert txns[0].uw_bucket == "WATCH"
    assert "ROUND_CREDIT_IN_SALES" in txns[0].uw_reasons


def test_large_odd_fig_credit_sets_risk():
    txns = [_txn(1, typ="ODD FIG", cr=600000.0, party="LENDER", narr="RTGS/LENDER/REF")]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert txns[0].uw_bucket in {"RISK", "FRAUD_SUSPECT"}
    assert "ACCOMMODATION_ENTRY" in txns[0].uw_reasons


def test_odd_fig_10l_sets_fraud_suspect():
    txns = [_txn(1, typ="ODD FIG", cr=1000000.0, party="LENDER", narr="RTGS/LENDER/REF")]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert txns[0].uw_bucket == "FRAUD_SUSPECT"
    assert "ACCOMMODATION_ENTRY_10L_PLUS" in txns[0].uw_reasons


def test_pvt_fin_recurrence_sets_risk():
    txns = [
        _txn(1, typ="PVT FIN", dr=113000.0, month=4, party="ILAKKIA", narr="TR/CHEPA/ILAKKIA"),
        _txn(2, typ="PVT FIN", dr=113500.0, month=5, party="ILAKKIA", narr="TR/CHEPA/ILAKKIA"),
        _txn(3, typ="PVT FIN", dr=112800.0, month=6, party="ILAKKIA", narr="TR/CHEPA/ILAKKIA"),
    ]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert any("PVT_EMI_PATTERN" in t.uw_reasons for t in txns)
    assert any(t.uw_bucket in {"RISK", "FRAUD_SUSPECT"} for t in txns)


def test_bounce_cluster_sets_risk_tag():
    txns = [
        _txn(1, typ="RETURN", dr=1000.0, month=8, party="X", narr="INW CHQ RET CHRGS"),
        _txn(2, typ="RETURN", dr=2000.0, month=8, party="Y", narr="CHQ RET BOUNCE"),
    ]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert all("BOUNCE_CLUSTER" in t.uw_reasons for t in txns)
    assert all(t.uw_bucket in {"RISK", "FRAUD_SUSPECT"} for t in txns)


def test_doubt_high_value_sets_risk():
    txns = [_txn(1, typ="DOUBT", dr=250000.0, party="UNKNOWN", narr="SOME UNKNOWN TOKEN")]
    ctx = build_account_context(txns)
    apply_underwriting(txns, ctx)
    assert txns[0].uw_bucket in {"RISK", "FRAUD_SUSPECT"}
    assert "UNEXPLAINED_TXN" in txns[0].uw_reasons


def test_street_verdict_reject_for_heavy_odd_fig():
    txns = [
        _txn(1, typ="ODD FIG", cr=300000.0, party="L1", narr="RTGS/L1/REF"),
        _txn(2, typ="SALES", cr=700000.0, party="BUYER", narr="RTGS/BUYER/REF"),
    ]
    ctx = build_account_context(txns)
    _, rollup = apply_underwriting(txns, ctx)
    assert rollup.street_verdict == "REJECT"
    assert rollup.street_limit_suggested_rupees == 0.0


def test_street_verdict_hold_on_obligation_coverage():
    txns = [
        _txn(1, typ="SALES", cr=100000.0, party="BUYER", narr="RTGS/BUYER/REFX1"),
        _txn(2, typ="BANK FIN", dr=60000.0, party="BANK", narr="INT.COLL"),
    ]
    ctx = build_account_context(txns)
    _, rollup = apply_underwriting(txns, ctx)
    assert rollup.street_verdict == "HOLD"
    assert rollup.street_limit_suggested_rupees == 0.0


def test_street_verdict_approve_with_min_floor():
    txns = [
        _txn(1, typ="SALES", cr=300000.0, party="TRADE A", narr="RTGS/TRADE A/REF123"),
        _txn(2, typ="SALES", cr=310000.0, party="TRADE B", narr="NEFT/TRADE B/REF456"),
        _txn(3, typ="PURCHASE", dr=100000.0, party="SUPP", narr="RTGS/SUPP/REF789"),
    ]
    ctx = build_account_context(txns)
    _, rollup = apply_underwriting(txns, ctx)
    assert rollup.street_verdict == "APPROVE"
    assert rollup.street_limit_suggested_rupees >= 500000.0


def test_underwriting_preserves_row_count():
    txns = [
        _txn(1, typ="SALES", cr=123456.0, party="A", narr="RTGS/A/REF"),
        _txn(2, typ="RETURN", dr=2500.0, party="A", narr="INW CHQ RET CHRGS"),
        _txn(3, typ="ODD FIG", cr=1000000.0, party="B", narr="RTGS/B/REF"),
    ]
    ctx = build_account_context(txns)
    out, _ = apply_underwriting(txns, ctx)
    assert len(out) == len(txns)
