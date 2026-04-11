from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter
from app.parsers.banks.row_refiners import refine_axis_drcr_indicator, refine_common_row
from app.parsers.interfaces import ParsedStatement, PdfDocument


class AxisAdapter(TokenBankAdapter):
    code = "AXIS"

    def __init__(self) -> None:
        super().__init__(code="AXIS", detect_tokens=("AXIS BANK",))

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        parsed = super().parse(doc, config)
        for row in parsed.rows:
            refine_common_row(row)
            refine_axis_drcr_indicator(row)
        parsed.metadata.source_bank = "AXIS"
        return parsed
