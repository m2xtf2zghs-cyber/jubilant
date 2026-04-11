from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import fitz
except Exception:  # pragma: no cover
    fitz = None


PDF_EDITING_TOOL_MARKERS = (
    "ACROBAT",
    "ILOVEPDF",
    "SEJDA",
    "LIBREOFFICE",
    "MICROSOFT",
    "WORD",
    "EXCEL",
    "POWERPOINT",
    "WPS",
    "CANVA",
    "QUARTZ PDFCONTEXT",
    "CHROME",
    "WKHTMLTOPDF",
)

SCAN_PRODUCER_MARKERS = (
    "SCAN",
    "SCANNER",
    "HP",
    "EPSON",
    "CANON",
    "BROTHER",
    "RICOH",
    "XEROX",
    "KONICA",
)


@dataclass
class IntegritySignal:
    code: str
    severity: str
    message: str


@dataclass
class PdfIntegrityResult:
    file_name: str
    verdict: str
    score: int
    confidence: float
    summary: str
    page_count: int
    text_page_count: int
    image_only_page_count: int
    is_encrypted: bool
    has_digital_signature: bool
    has_incremental_updates: bool
    creator: str | None
    producer: str | None
    creation_date: str | None
    mod_date: str | None
    signals: list[IntegritySignal]


def _pdf_date_to_iso(raw: str | None) -> str | None:
    if not raw:
        return None
    value = raw.strip()
    if value.startswith("D:"):
        value = value[2:]
    for width, fmt in (
        (14, "%Y%m%d%H%M%S"),
        (12, "%Y%m%d%H%M"),
        (8, "%Y%m%d"),
    ):
        if len(value) >= width:
            try:
                return datetime.strptime(value[:width], fmt).isoformat()
            except ValueError:
                continue
    return raw


class PdfIntegrityAnalyzer:
    """
    Heuristic integrity analyzer.

    This is not a cryptographic proof of originality. It surfaces suspicious
    edit history, producer metadata, and PDF structure signals so analysts can
    triage statements the way Perfios-style systems do.
    """

    def analyze(self, file_path: str) -> PdfIntegrityResult:
        path = Path(file_path)
        payload = path.read_bytes()
        signals: list[IntegritySignal] = []
        score = 0

        startxref_count = payload.count(b"startxref")
        has_incremental_updates = startxref_count > 1 or b"/Prev" in payload
        has_digital_signature = b"/ByteRange" in payload or b"/Sig" in payload
        has_xfa = b"/XFA" in payload
        has_embedded_files = b"/EmbeddedFile" in payload or b"/Filespec" in payload
        has_redaction = b"/Redact" in payload
        has_javascript = b"/JavaScript" in payload or b"/JS" in payload

        metadata: dict[str, Any] = {}
        page_count = 0
        text_page_count = 0
        image_only_page_count = 0
        is_encrypted = False

        if fitz is not None:
            with fitz.open(path) as doc:
                metadata = doc.metadata or {}
                page_count = doc.page_count
                is_encrypted = bool(doc.is_encrypted)
                for page in doc:
                    text = (page.get_text("text") or "").strip()
                    images = page.get_images(full=True)
                    if text:
                        text_page_count += 1
                    if images and not text:
                        image_only_page_count += 1
        else:  # pragma: no cover
            signals.append(IntegritySignal(code="fitz_unavailable", severity="medium", message="PyMuPDF not available; integrity signals are partial"))

        creator = (metadata.get("creator") or "").strip() or None
        producer = (metadata.get("producer") or "").strip() or None
        creation_date = _pdf_date_to_iso(metadata.get("creationDate"))
        mod_date = _pdf_date_to_iso(metadata.get("modDate"))

        if is_encrypted:
            score += 10
            signals.append(IntegritySignal(code="encrypted_pdf", severity="medium", message="PDF is encrypted; integrity inspection is partially limited"))
        if has_digital_signature:
            signals.append(IntegritySignal(code="digital_signature", severity="low", message="Digital signature markers found in the PDF structure"))
        if has_incremental_updates:
            score += 45
            signals.append(IntegritySignal(code="incremental_update_history", severity="high", message="Multiple cross-reference sections suggest the file was saved or modified after initial creation"))
        if has_xfa:
            score += 10
            signals.append(IntegritySignal(code="xfa_form", severity="medium", message="Dynamic XFA form markers found; generated forms often need manual review"))
        if has_embedded_files:
            score += 10
            signals.append(IntegritySignal(code="embedded_files", severity="medium", message="Embedded file markers found inside the PDF"))
        if has_redaction:
            score += 35
            signals.append(IntegritySignal(code="redaction_markup", severity="high", message="Redaction markers found, which can indicate document editing"))
        if has_javascript:
            score += 15
            signals.append(IntegritySignal(code="javascript_actions", severity="medium", message="JavaScript actions were found in the PDF structure"))

        tool_source = " ".join(part for part in (creator or "", producer or "") if part).upper()
        if any(marker in tool_source for marker in PDF_EDITING_TOOL_MARKERS):
            score += 20
            signals.append(IntegritySignal(code="editing_tool_metadata", severity="high", message=f"Metadata references editing/generation tools: {tool_source}"))
        elif any(marker in tool_source for marker in SCAN_PRODUCER_MARKERS):
            signals.append(IntegritySignal(code="scanner_metadata", severity="low", message=f"Metadata suggests scanner output: {tool_source}"))

        if creation_date and mod_date and mod_date != creation_date:
            score += 15
            signals.append(IntegritySignal(code="moddate_differs", severity="medium", message="Creation date and modification date differ"))

        if page_count and image_only_page_count == page_count and text_page_count == 0:
            signals.append(IntegritySignal(code="image_only_pdf", severity="low", message="Pages appear to be scanned images without embedded text"))
        elif text_page_count and text_page_count == page_count:
            signals.append(IntegritySignal(code="searchable_text_pdf", severity="low", message="All pages contain embedded text"))

        score = min(score, 100)
        if has_digital_signature and score < 35:
            verdict = "DIGITALLY_SIGNED"
            confidence = 0.92
            summary = "Digital signature markers found and no strong edit-history signals were detected."
        elif score >= 60:
            verdict = "LIKELY_EDITED"
            confidence = 0.88
            summary = "The PDF contains multiple structural or metadata signals consistent with post-generation editing."
        elif page_count and image_only_page_count == page_count and score < 30:
            verdict = "SCANNED_ORIGINAL_LIKELY"
            confidence = 0.73
            summary = "The PDF looks like a scan and does not show strong structural edit signals."
        elif tool_source and any(marker in tool_source for marker in PDF_EDITING_TOOL_MARKERS):
            verdict = "DIGITALLY_GENERATED_OR_EXPORTED"
            confidence = 0.78
            summary = "The PDF appears digitally generated/exported; originality cannot be guaranteed without bank-side provenance."
        else:
            verdict = "LIKELY_ORIGINAL"
            confidence = 0.68
            summary = "No strong edit-history signals were found, but this remains a heuristic integrity check."

        return PdfIntegrityResult(
            file_name=path.name,
            verdict=verdict,
            score=score,
            confidence=confidence,
            summary=summary,
            page_count=page_count,
            text_page_count=text_page_count,
            image_only_page_count=image_only_page_count,
            is_encrypted=is_encrypted,
            has_digital_signature=has_digital_signature,
            has_incremental_updates=has_incremental_updates,
            creator=creator,
            producer=producer,
            creation_date=creation_date,
            mod_date=mod_date,
            signals=signals,
        )
