from datetime import date

from app.core.domain import CanonicalTransaction
from app.detection.private_fin import PrivateFinanceDetector
from app.detection.transfer_reconciler import TransferReconciler


def _txn(**kwargs) -> CanonicalTransaction:
    defaults = dict(
        job_id="J1",
        source_file="f.pdf",
        source_bank="IOB",
        source_account_no="140502000000251",
        source_account_name="AISHWARYA TRANSPORT",
        source_account_type="CC",
        page_no=1,
        line_ref=1,
        raw_narration="TR/CHEPA/AFFAN METALS",
        cleaned_narration="TR/CHEPA/AFFAN METALS",
        debit=0.0,
        credit=0.0,
        month_key="APR(25)",
        txn_date=date(2025, 4, 2),
        classification_primary="UNKNOWN",
        normalized_party="AFFAN METALS",
        confidence_score=0.4,
    )
    defaults.update(kwargs)
    return CanonicalTransaction(**defaults)


def test_transfer_reconciler_promotes_unmatched_sis_con() -> None:
    source = _txn(debit=300000, classification_primary="UNMATCH SIS CON")
    target = _txn(
        source_bank="SBI",
        source_account_no="1234567890123456",
        source_account_name="AFFAN METALS",
        raw_narration="TR/CHEPA/AISHWARYA TRANSPORT",
        cleaned_narration="TR/CHEPA/AISHWARYA TRANSPORT",
        credit=300000,
        debit=0.0,
        normalized_party="AISHWARYA TRANSPORT",
    )

    TransferReconciler().tag([source, target])
    assert source.classification_primary == "SIS CON"


def test_private_fin_detector_overrides_sales_purchase_loop() -> None:
    rows = [
        _txn(
            source_account_name="MAIN BORROWER",
            raw_narration="RTGS/ADIMOOLAM N/ICICR52025082100805504",
            cleaned_narration="RTGS/ADIMOOLAM N/ICICR52025082100805504",
            normalized_party="ADIMOOLAM N",
            credit=1000000,
            debit=0.0,
            txn_date=date(2025, 4, 1),
            month_key="APR(25)",
            classification_primary="SALES",
        ),
        _txn(
            source_account_name="MAIN BORROWER",
            raw_narration="NEFT/ADIMOOLAM N/REPAYMENT",
            cleaned_narration="NEFT/ADIMOOLAM N/REPAYMENT",
            normalized_party="ADIMOOLAM N",
            credit=0.0,
            debit=120000,
            txn_date=date(2025, 4, 15),
            month_key="APR(25)",
            classification_primary="PURCHASE",
        ),
        _txn(
            source_account_name="MAIN BORROWER",
            raw_narration="NEFT/ADIMOOLAM N/REPAYMENT",
            cleaned_narration="NEFT/ADIMOOLAM N/REPAYMENT",
            normalized_party="ADIMOOLAM N",
            credit=0.0,
            debit=120000,
            txn_date=date(2025, 5, 15),
            month_key="MAY(25)",
            classification_primary="PURCHASE",
        ),
    ]

    PrivateFinanceDetector().tag(rows)
    assert {row.classification_primary for row in rows} == {"PVT FIN"}
