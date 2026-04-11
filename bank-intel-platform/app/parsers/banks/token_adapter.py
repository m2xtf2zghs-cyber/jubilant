from __future__ import annotations

import re

from app.parsers.generic.statement_parser import GenericStatementParser
from app.parsers.interfaces import ParsedStatement, PdfDocument


def _header_sample(doc: PdfDocument, max_lines: int = 40) -> str:
    lines: list[str] = []
    for p in doc.pages[:2]:
        lines.extend(p.lines[: max_lines // 2])
    return "\n".join(lines).upper()


class TokenBankAdapter(GenericStatementParser):
    code = "GENERIC"
    detect_tokens: tuple[str, ...] = ()

    def __init__(self, code: str, detect_tokens: tuple[str, ...]) -> None:
        super().__init__(bank_hint=code)
        self.code = code
        self.detect_tokens = detect_tokens

    def detect_score(self, doc: PdfDocument, config: dict) -> float:
        sample = _header_sample(doc)
        conf = config.get("bank_patterns", {}).get(self.code, {})
        tokens = tuple(str(t).upper() for t in conf.get("detect_tokens", list(self.detect_tokens)))
        if not tokens:
            tokens = self.detect_tokens

        hits = 0
        for t in tokens:
            t = (t or "").strip().upper()
            if not t:
                continue
            # Very short tokens (e.g. SBI/IOB) are noisy in narration refs; ignore unless paired with BANK.
            if len(t) <= 4 and " " not in t and "BANK" not in t:
                continue
            if re.search(rf"(?<![A-Z0-9]){re.escape(t)}(?![A-Z0-9])", sample):
                hits += 1
        if hits == 0:
            return 0.0
        score = min(1.0, 0.45 + 0.2 * hits)
        return score

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        parsed = super().parse(doc, config)
        parsed.metadata.source_bank = self.code
        self._enrich_account_type(parsed, doc)
        return parsed

    @staticmethod
    def _enrich_account_type(parsed: ParsedStatement, doc: PdfDocument) -> None:
        if parsed.metadata.source_account_type:
            return
        sample = _header_sample(doc)
        if re.search(r"\bOVERDRAFT\b|\bOD\b", sample):
            parsed.metadata.source_account_type = "OD"
            return
        if re.search(r"\bCASH CREDIT\b|\bCC\b", sample):
            parsed.metadata.source_account_type = "CC"
            return
        if re.search(r"\bCURRENT\b|\bCA\b", sample):
            parsed.metadata.source_account_type = "CA"
            return
        if re.search(r"\bSAVINGS\b|\bSB\b", sample):
            parsed.metadata.source_account_type = "SA"
