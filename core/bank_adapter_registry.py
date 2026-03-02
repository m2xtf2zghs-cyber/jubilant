from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

try:
    import pdfplumber
except Exception:  # pragma: no cover
    pdfplumber = None

from core.adapters.generic_adapter import GenericAdapter
from core.adapters.tmb_adapter import TmbAdapter
from core.bank_adapter_base import PdfDocument, PdfPage, RawRow, StatementMetadata
from core.bank_header_patterns import detect_bank


@dataclass
class ExtractedStatement:
    doc: PdfDocument
    adapter_code: str
    rows: List[RawRow]


def _mask_account_no(acct: Optional[str]) -> Optional[str]:
    if not acct:
        return None
    digits = re.sub(r"\D", "", acct)
    if len(digits) < 6:
        return None
    return "X" * (len(digits) - 5) + digits[-5:]


def load_pdf_document(filepath: str, max_pages: Optional[int] = None) -> PdfDocument:
    if pdfplumber is None:
        raise RuntimeError("pdfplumber is required for PDF ingestion")

    pages: List[PdfPage] = []
    meta = StatementMetadata()

    with pdfplumber.open(filepath) as pdf:
        total = len(pdf.pages)
        limit = min(total, max_pages) if max_pages else total

        for i in range(limit):
            page = pdf.pages[i]
            text = page.extract_text() or ""
            lines = [ln.rstrip("\n") for ln in text.splitlines() if ln.strip() != ""]
            pages.append(PdfPage(page_no=i + 1, text=text, lines=lines))

    return PdfDocument(filepath=filepath, pages=pages, metadata=meta)


def _detect_bank_code(doc: PdfDocument) -> Tuple[str, float]:
    sample_text = "\n".join(p.text for p in doc.pages[:2])
    code, score = detect_bank(sample_text)
    return code, score


def get_adapter(doc: PdfDocument) -> Tuple[object, str]:
    """
    Returns (adapter_instance, detected_bank_code)
    Adapter selection logic:
      - Try TMB adapter if bank code says TMB
      - else generic
    """
    bank_code, score = _detect_bank_code(doc)
    if bank_code == "TMB":
        return TmbAdapter(), bank_code
    return GenericAdapter(bank_code_hint=bank_code, bank_score=score), bank_code


def extract_statement(filepath: str, config: object | None = None) -> ExtractedStatement:
    del config  # Reserved for future adapter settings.
    doc = load_pdf_document(filepath)

    adapter, _bank_code = get_adapter(doc)
    try:
        doc.metadata = adapter.extract_metadata(doc)
    except Exception:
        pass

    doc.metadata.account_no_masked = _mask_account_no(doc.metadata.account_no)

    rows = adapter.extract_rows(doc)
    return ExtractedStatement(doc=doc, adapter_code=getattr(adapter, "code", "UNKNOWN"), rows=rows)


def extract_statements(filepaths: list[str], config: object | None = None) -> list[ExtractedStatement]:
    return [extract_statement(path, config=config) for path in filepaths]
