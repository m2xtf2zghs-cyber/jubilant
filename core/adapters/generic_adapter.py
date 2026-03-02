from __future__ import annotations

import re
from typing import List, Optional

from core.amount_date_parsers import parse_date
from core.bank_adapter_base import PdfDocument, RawRow, StatementMetadata


DATE_START_RE = re.compile(
    r"^\s*(?:\d+\s+)?(?P<date>(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(?:\d{1,2}[./-][A-Za-z]{3}[./-]\d{2,4})|(?:\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}))\b",
    re.IGNORECASE,
)
AMOUNT_TOKEN_RE = re.compile(r"(?<!\w)(?:\(?-?\d[\d,]*\.\d{1,2}\)?|\(?-?\d[\d,]*\)?)(?!\w)")


def _norm_line(s: str) -> str:
    s = s.replace("\u00A0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _looks_like_date_prefix(line: str) -> Optional[str]:
    m = DATE_START_RE.match(line)
    return m.group("date") if m else None


def _split_row_tokens(line: str) -> list[str]:
    # naive split by two+ spaces or tabs; keeps narration chunkier
    parts = re.split(r"\s{2,}|\t+", line.strip())
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) <= 1:
        parts = line.strip().split()
    return parts


def _extract_amounts_from_end(line: str, max_take: int = 3) -> list[str]:
    """
    Many statements end with: <debit> <credit> <balance> (or variations).
    We greedily pull numeric-like tokens from the end.
    """
    toks = _split_row_tokens(line)
    # pull last numeric-like tokens
    nums: list[str] = []
    for tok in reversed(toks):
        if AMOUNT_TOKEN_RE.fullmatch(tok.replace("₹", "").strip()):
            nums.append(tok)
            if len(nums) >= max_take:
                break
        else:
            # stop if we already started collecting numbers and hit a non-number
            if nums:
                break
    return list(reversed(nums))


def _strip_trailing_amounts(line: str, amounts: list[str]) -> str:
    if not amounts:
        return line
    # remove only the last occurrence segments
    s = line
    for amt in reversed(amounts):
        # remove last occurrence of amt as a token
        s = re.sub(rf"(?:\s{{2,}}|\t+|\s+){re.escape(amt)}\s*$", "", s)
    return s.strip()


class GenericAdapter:
    """
    Generic line-based adapter:
    - Uses "date prefix" to identify row starts
    - Appends non-date lines to previous narration (multiline)
    - Extracts amounts from line end heuristics
    """

    code = "GENERIC"

    def __init__(self, bank_code_hint: str = "GENERIC", bank_score: float = 0.0):
        self.bank_code_hint = bank_code_hint
        self.bank_score = bank_score

    def detect(self, doc: PdfDocument) -> float:
        # Generic always available with moderate score
        return 0.5

    def extract_metadata(self, doc: PdfDocument) -> StatementMetadata:
        # Best-effort: try to pull bank name from hint
        meta = doc.metadata
        if not meta.bank_name and self.bank_code_hint and self.bank_code_hint != "GENERIC":
            meta.bank_name = self.bank_code_hint
        return meta

    def extract_rows(self, doc: PdfDocument) -> List[RawRow]:
        rows: List[RawRow] = []
        current: Optional[RawRow] = None

        for page in doc.pages:
            for li, raw_line in enumerate(page.lines, start=1):
                line = _norm_line(raw_line)
                if not line:
                    continue

                dt = _looks_like_date_prefix(line)

                if dt:
                    # start new row
                    if current is not None:
                        rows.append(current)

                    # try extract trailing amounts
                    amounts = _extract_amounts_from_end(line, max_take=3)
                    balance_str = amounts[-1] if len(amounts) >= 1 else None

                    debit_str = None
                    credit_str = None
                    # If we got 3 numbers: likely debit, credit, balance OR withdrawal, deposit, balance
                    # If 2 numbers: likely amount + balance
                    if len(amounts) == 3:
                        debit_str, credit_str = amounts[0], amounts[1]
                    elif len(amounts) == 2:
                        # ambiguous; keep both empty and store amount in narration for now
                        debit_str, credit_str = None, None

                    body = _strip_trailing_amounts(line, amounts)
                    # remove optional serial number + date token at start
                    body = re.sub(r"^\s*(?:\d+\s+)?"+re.escape(dt)+r"\s*", "", body).strip()

                    current = RawRow(
                        txn_date_str=dt,
                        narration=body,
                        debit_str=debit_str,
                        credit_str=credit_str,
                        balance_str=balance_str,
                        cheque_ref_str=None,
                        source_page=page.page_no,
                        source_line=li,
                    )
                else:
                    # continuation line; append to narration
                    if current is not None:
                        current.narration = (current.narration + " " + line).strip()

        if current is not None:
            rows.append(current)

        # Validate date parsability at least; do not drop rows
        # (Downstream recon will flag issues)
        _ = [self._safe_date(r.txn_date_str) for r in rows]
        return rows

    @staticmethod
    def _safe_date(s: str):
        try:
            return parse_date(s)
        except Exception:
            return None
