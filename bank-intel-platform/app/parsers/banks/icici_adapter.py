from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter
from app.parsers.banks.row_refiners import refine_common_row
from app.parsers.interfaces import ParsedStatement, PdfDocument


class IciciAdapter(TokenBankAdapter):
    code = "ICICI"

    def __init__(self) -> None:
        super().__init__(code="ICICI", detect_tokens=("ICICI BANK", "ICICI"))

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        parsed = super().parse(doc, config)
        for row in parsed.rows:
            refine_common_row(row)
        parsed.metadata.source_bank = "ICICI"
        return parsed
