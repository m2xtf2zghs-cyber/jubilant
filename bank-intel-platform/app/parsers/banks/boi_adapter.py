from __future__ import annotations

from app.parsers.generic.statement_parser import GenericStatementParser
from app.parsers.interfaces import ParsedStatement, PdfDocument


class BoiAdapter(GenericStatementParser):
    code = "BOI"

    def __init__(self) -> None:
        super().__init__(bank_hint="BOI")

    def detect_score(self, doc: PdfDocument, config: dict) -> float:
        tokens = config.get("bank_patterns", {}).get("BOI", {}).get("detect_tokens", [])
        sample = "\n".join(line for p in doc.pages[:2] for line in p.lines[:40]).upper()
        score = 0.0
        for token in tokens:
            if str(token).upper() in sample:
                score += 0.5
        if "SL NO" in sample and "WITHDRAWAL" in sample and "DEPOSITS" in sample:
            score += 0.6
        return min(score, 1.0)

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        parsed = super().parse(doc, config)
        parsed.metadata.source_bank = "BOI"
        return parsed
