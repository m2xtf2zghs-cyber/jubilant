from __future__ import annotations

from app.parsers.bank_header_patterns import detect_bank
from app.parsers.banks.axis_adapter import AxisAdapter
from app.parsers.banks.canara_adapter import CanaraAdapter
from app.parsers.banks.federal_adapter import FederalAdapter
from app.parsers.banks.hdfc_adapter import HdfcAdapter
from app.parsers.banks.indusind_adapter import IndusindAdapter
from app.parsers.banks.icici_adapter import IciciAdapter
from app.parsers.banks.iob_adapter import IobAdapter
from app.parsers.banks.kvb_adapter import KvbAdapter
from app.parsers.banks.sbi_adapter import SbiAdapter
from app.parsers.banks.tmb_adapter import TmbAdapter
from app.parsers.banks.boi_adapter import BoiAdapter
from app.parsers.banks.yes_adapter import YesAdapter
from app.parsers.generic.statement_parser import GenericStatementParser
from app.parsers.interfaces import BankAdapter, PdfDocument


class BankParserRegistry:
    def __init__(self) -> None:
        self.adapters: list[BankAdapter] = [
            TmbAdapter(),
            BoiAdapter(),
            HdfcAdapter(),
            SbiAdapter(),
            IciciAdapter(),
            AxisAdapter(),
            CanaraAdapter(),
            IobAdapter(),
            KvbAdapter(),
            FederalAdapter(),
            IndusindAdapter(),
            YesAdapter(),
        ]
        self.by_code: dict[str, BankAdapter] = {a.code.upper(): a for a in self.adapters}

    @staticmethod
    def _header_sample(doc: PdfDocument, max_lines: int = 40) -> str:
        lines: list[str] = []
        for p in doc.pages[:2]:
            lines.extend(p.lines[: max_lines // 2])
        return "\n".join(lines)

    def pick(self, doc: PdfDocument, config: dict) -> BankAdapter:
        header_text = self._header_sample(doc)
        detected_code, detected_score = detect_bank(header_text)

        # Prefer explicit bank header signal; avoids false positives from transaction refs.
        if detected_code != "GENERIC" and detected_score >= 0.7:
            adapter = self.by_code.get(detected_code)
            if adapter is not None:
                return adapter

        best: BankAdapter | None = None
        best_score = 0.0
        for adapter in self.adapters:
            score = adapter.detect_score(doc, config)
            if score > best_score:
                best_score = score
                best = adapter

        # Conservative threshold: unknown layouts should stay Generic, not wrong bank.
        if best is None or best_score < 0.65:
            hint = detected_code if detected_code != "GENERIC" and detected_score >= 0.45 else "GENERIC"
            return GenericStatementParser(bank_hint=hint)
        return best
