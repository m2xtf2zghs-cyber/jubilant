from app.parsers.bank_header_patterns import detect_bank
from app.parsers.banks.axis_adapter import AxisAdapter
from app.parsers.bank_registry import BankParserRegistry
from app.parsers.interfaces import PdfDocument, PdfPage


def test_detect_bank_hdfc_header_not_utr_only() -> None:
    text = """
    HDFC BANK
    Account Statement
    Date Narration Chq/Ref No Withdrawal Deposit Closing Balance
    """
    code, score = detect_bank(text)
    assert code == "HDFC"
    assert score >= 0.45


def test_detect_bank_does_not_misclassify_hdfc_from_txn_refs() -> None:
    text = """
    TAMILNAD MERCANTILE BANK
    TRANSACTIONS LIST - CAFLX-
    RTGS/MTC BUSINESS/HDFCR52025080196730628
    """
    code, _score = detect_bank(text)
    assert code == "TMB"


def test_registry_prefers_generic_when_header_unknown() -> None:
    doc = PdfDocument(
        source_file="x.pdf",
        pages=[
            PdfPage(
                page_no=1,
                text="Unlabeled statement data",
                lines=[
                    "Date Desc Debit Credit Balance",
                    "01-01-2026 RTGS/MTC/HDFCR52025080196730628 1000 0 5000",
                ],
            )
        ],
    )
    adapter = BankParserRegistry().pick(doc, config={"bank_patterns": {}})
    assert adapter.code == "GENERIC"


def test_detect_bank_additional_profiles() -> None:
    assert detect_bank("CANARA BANK account statement")[0] == "CANARA"
    assert detect_bank("INDIAN OVERSEAS BANK mini statement")[0] == "IOB"
    assert detect_bank("KARUR VYSYA BANK statement")[0] == "KVB"
    assert detect_bank("FEDERAL BANK statement")[0] == "FEDERAL"
    assert detect_bank("INDUSIND BANK statement")[0] == "INDUSIND"
    assert detect_bank("YES BANK statement")[0] == "YES"


def test_axis_parse_maps_drcr_indicator_to_debit() -> None:
    adapter = AxisAdapter()
    doc = PdfDocument(
        source_file="axis.pdf",
        pages=[
            PdfPage(
                page_no=1,
                text="AXIS BANK\nDate Particulars Chq No Amount Balance",
                lines=[
                    "Date Particulars Chq No Amount Balance",
                    "01-02-2026 IMPS/TEST PARTY/12345 1,00,000.00 DR 5,00,000.00",
                ],
            )
        ],
    )
    parsed = adapter.parse(doc, config={"bank_patterns": {}})
    assert len(parsed.rows) == 1
    assert parsed.rows[0].debit_text is not None
