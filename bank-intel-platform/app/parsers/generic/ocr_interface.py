from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class OcrPageResult:
    text: str
    confidence: float


class OcrEngine(Protocol):
    def run(self, pdf_path: str, page_index: int) -> OcrPageResult: ...


class NullOcrEngine:
    """Placeholder engine. Keeps OCR path pluggable for future swap (Tesseract/cloud OCR)."""

    def run(self, pdf_path: str, page_index: int) -> OcrPageResult:
        _ = (pdf_path, page_index)
        return OcrPageResult(text="", confidence=0.0)
