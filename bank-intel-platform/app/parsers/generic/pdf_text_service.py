from __future__ import annotations

from pathlib import Path

import pdfplumber

from app.parsers.interfaces import PdfDocument, PdfPage

try:
    import fitz
except Exception:  # pragma: no cover - optional dependency fallback
    fitz = None


class PdfTextExtractionService:
    """
    Text-first extraction service.
    Falls back to PyMuPDF text extraction if pdfplumber returns empty text.
    OCR is intentionally abstracted for future implementation.
    """

    def extract(self, file_path: str) -> PdfDocument:
        pages: list[PdfPage] = []
        source = str(Path(file_path).resolve())

        with pdfplumber.open(source) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                if not text.strip():
                    text = self._extract_with_pymupdf(source, idx - 1)
                lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
                pages.append(PdfPage(page_no=idx, text=text, lines=lines))

        return PdfDocument(source_file=source, pages=pages)

    @staticmethod
    def _extract_with_pymupdf(file_path: str, page_index: int) -> str:
        if fitz is None:
            return ""
        with fitz.open(file_path) as doc:
            return doc[page_index].get_text("text")
