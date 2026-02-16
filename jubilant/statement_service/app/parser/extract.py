from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

import pdfplumber


DATE_RE = re.compile(r"^\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s*$")


@dataclass
class RawLine:
    page_no: int
    row_no: int
    raw_row_text: str
    date_text: Optional[str]
    narration_text: Optional[str]
    dr_text: Optional[str]
    cr_text: Optional[str]
    bal_text: Optional[str]
    line_type: str  # TRANSACTION / NON_TXN_LINE
    extraction_method: str = "pdfplumber"


def _looks_like_amount(value: str) -> bool:
    if not value:
        return False
    value = value.replace(",", "").replace(" ", "").strip()
    return bool(re.fullmatch(r"-?\d+(\.\d{1,2})?", value))


def extract_raw_lines_pdfplumber(pdf_path: str) -> List[RawLine]:
    """
    Generic extractor:
    - Uses table extraction when available.
    - Falls back to line extraction.
    - Persists both TRANSACTION and NON_TXN_LINE rows for strict reconciliation.
    """
    lines: List[RawLine] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            page_no = page_index + 1
            row_no = 0

            tables = page.extract_tables() or []
            if tables:
                for table in tables:
                    for row in table:
                        row_no += 1
                        cells = [str(cell).strip() if cell is not None else "" for cell in row]
                        joined = " | ".join(cells).strip(" |")
                        if not joined:
                            continue

                        date_text = cells[0] if cells and DATE_RE.match(cells[0]) else None
                        numeric_cells = [c for c in cells if _looks_like_amount(c)]
                        line_type = "TRANSACTION" if date_text and numeric_cells else "NON_TXN_LINE"

                        lines.append(
                            RawLine(
                                page_no=page_no,
                                row_no=row_no,
                                raw_row_text=joined,
                                date_text=date_text,
                                narration_text=None,
                                dr_text=None,
                                cr_text=None,
                                bal_text=None,
                                line_type=line_type,
                                extraction_method="pdfplumber_table",
                            )
                        )
                continue

            text = page.extract_text() or ""
            for text_line in text.splitlines():
                row_no += 1
                cleaned = text_line.strip()
                if not cleaned:
                    continue

                match = re.match(r"^(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+(.*)$", cleaned)
                if match:
                    lines.append(
                        RawLine(
                            page_no=page_no,
                            row_no=row_no,
                            raw_row_text=cleaned,
                            date_text=match.group(1),
                            narration_text=match.group(2),
                            dr_text=None,
                            cr_text=None,
                            bal_text=None,
                            line_type="TRANSACTION",
                            extraction_method="pdfplumber_text",
                        )
                    )
                else:
                    lines.append(
                        RawLine(
                            page_no=page_no,
                            row_no=row_no,
                            raw_row_text=cleaned,
                            date_text=None,
                            narration_text=cleaned,
                            dr_text=None,
                            cr_text=None,
                            bal_text=None,
                            line_type="NON_TXN_LINE",
                            extraction_method="pdfplumber_text",
                        )
                    )
    return lines


def merge_multiline_transactions(raw_lines: List[RawLine]) -> List[dict]:
    """
    Strict mapping:
    - Transaction starts when a line has an explicit date.
    - Continuation lines without a date append to narration.
    """
    merged: List[dict] = []
    current: Optional[dict] = None

    for index, raw_line in enumerate(raw_lines):
        if raw_line.line_type == "TRANSACTION" and raw_line.date_text:
            if current:
                merged.append(current)
            current = {
                "raw_indices": [index],
                "date_text": raw_line.date_text,
                "narration": raw_line.raw_row_text,
                "dr_text": raw_line.dr_text,
                "cr_text": raw_line.cr_text,
                "bal_text": raw_line.bal_text,
            }
            continue

        if current and raw_line.raw_row_text:
            current["raw_indices"].append(index)
            current["narration"] = f"{current['narration']} {raw_line.raw_row_text}".strip()

    if current:
        merged.append(current)

    return merged
