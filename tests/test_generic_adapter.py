from __future__ import annotations

from core.adapters.generic_adapter import GenericAdapter
from core.bank_adapter_base import PdfDocument, PdfPage, StatementMetadata


def test_generic_adapter_handles_serial_before_date() -> None:
    doc = PdfDocument(
        filepath="dummy.pdf",
        metadata=StatementMetadata(bank_name="BOI"),
        pages=[
            PdfPage(
                page_no=1,
                text="",
                lines=[
                    "Sl Date Narration Debit Credit Balance",
                    "1 23/12/2025 RTGS/ABC ENTERPRISE/REF123 1,000.00 0.00 10,000.00",
                    "2 24/12/2025 CASH DEPOSIT 0.00 2,500.00 12,500.00",
                ],
            )
        ],
    )

    rows = GenericAdapter(bank_code_hint="BOI", bank_score=0.9).extract_rows(doc)
    assert len(rows) == 2
    assert rows[0].txn_date_str == "23/12/2025"
    assert "RTGS/ABC ENTERPRISE/REF123" in rows[0].narration
    assert rows[1].txn_date_str == "24/12/2025"
