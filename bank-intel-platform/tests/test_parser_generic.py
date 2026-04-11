from app.parsers.generic.statement_parser import GenericStatementParser
from app.parsers.interfaces import PdfDocument, PdfPage


def test_generic_parser_row_and_continuation() -> None:
    parser = GenericStatementParser(bank_hint="BOI")
    doc = PdfDocument(
        source_file="sample.pdf",
        pages=[
            PdfPage(
                page_no=1,
                text="",
                lines=[
                    "Sl No Txn Date Description Cheque No Withdrawal Deposits Balance",
                    "1 23-12-2025 RTGS/BKIDH25358558841/HDFC/RELIANCE 999 7,00,000.00 -5,05,02,684.46",
                    "LIMIT",
                ],
            )
        ],
    )
    parsed = parser.parse(doc, config={})
    assert len(parsed.rows) == 1
    assert parsed.rows[0].cheque_no == "999"
    assert "LIMIT" in parsed.rows[0].narration
