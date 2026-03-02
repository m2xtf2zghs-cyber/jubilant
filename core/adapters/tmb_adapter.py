from __future__ import annotations

import re
from typing import List, Optional

from core.amount_date_parsers import parse_date
from core.bank_adapter_base import PdfDocument, RawRow, StatementMetadata
from core.bank_header_patterns import detect_table_header


DATE_START_RE = re.compile(
    r"^\s*(?:\d+\s+)?(?P<date>(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4})|(?:\d{1,2}[./-][A-Za-z]{3}[./-]\d{2,4})|(?:\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}))\b",
    re.IGNORECASE,
)


def _norm_line(s: str) -> str:
    s = s.replace("\u00A0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _looks_like_date_prefix(line: str) -> Optional[str]:
    m = DATE_START_RE.match(line)
    return m.group("date") if m else None


class TmbAdapter:
    """
    TMB-oriented extractor:
    - tries to locate the header row on each page, then processes only lines after header
    - multiline narration supported (non-date lines appended)
    - amount parsing remains heuristic; this is improved later with table extraction if needed
    """

    code = "TMB"

    def detect(self, doc: PdfDocument) -> float:
        # simple heuristic: presence of TMB tokens is handled in registry
        return 0.9

    def extract_metadata(self, doc: PdfDocument) -> StatementMetadata:
        meta = doc.metadata
        meta.bank_name = meta.bank_name or "TMB"

        # Best-effort account type from tokens
        sample = "\n".join(p.text for p in doc.pages[:2]).upper()
        if "ODGEN" in sample or "OVERDRAFT" in sample:
            meta.account_type = meta.account_type or "OD"
        if "CAFLX" in sample or "CURRENT" in sample:
            meta.account_type = meta.account_type or "CA"
        if "CASH CREDIT" in sample or " CC " in sample:
            meta.account_type = meta.account_type or "CC"

        # Try account number pattern (very best-effort)
        m = re.search(r"\bA\/C(?:COUNT)?\s*NO\.?\s*[:\-]?\s*([0-9]{9,18})\b", sample)
        if m:
            meta.account_no = meta.account_no or m.group(1)

        return meta

    def extract_rows(self, doc: PdfDocument) -> List[RawRow]:
        rows: List[RawRow] = []
        current: Optional[RawRow] = None

        for page in doc.pages:
            header_idx = detect_table_header(page.lines, bank_code="TMB")
            start_i = header_idx + 1 if header_idx is not None else 0

            for li in range(start_i, len(page.lines)):
                line = _norm_line(page.lines[li])
                if not line:
                    continue

                dt = _looks_like_date_prefix(line)
                if dt:
                    if current is not None:
                        rows.append(current)

                    # TMB lines often look: DATE <narration> <debit> <credit> <balance>
                    # We'll take last 3 numeric-like tokens as debit/credit/balance when possible.
                    parts = re.split(r"\s{2,}|\t+|\s+", line)
                    parts = [p for p in parts if p.strip()]

                    # Extract numeric-like tokens from the end
                    nums: List[str] = []
                    for tok in reversed(parts):
                        tok2 = tok.replace("₹", "").replace(",", "")
                        if re.fullmatch(r"\(?-?\d+(?:\.\d{1,2})?\)?", tok2):
                            nums.append(tok)
                            if len(nums) >= 3:
                                break
                        else:
                            if nums:
                                break
                    nums = list(reversed(nums))
                    balance_str = nums[-1] if len(nums) >= 1 else None
                    debit_str = nums[0] if len(nums) == 3 else None
                    credit_str = nums[1] if len(nums) == 3 else None

                    # Narration is everything between date and trailing nums
                    # Rebuild: remove date then remove trailing numeric tokens
                    body = line
                    body = re.sub(r"^\s*(?:\d+\s+)?"+re.escape(dt)+r"\s*", "", body).strip()
                    for tok in reversed(nums):
                        body = re.sub(rf"\s+{re.escape(tok)}\s*$", "", body)

                    current = RawRow(
                        txn_date_str=dt,
                        narration=body.strip(),
                        debit_str=debit_str,
                        credit_str=credit_str,
                        balance_str=balance_str,
                        cheque_ref_str=None,
                        source_page=page.page_no,
                        source_line=li + 1,
                    )
                else:
                    if current is not None:
                        current.narration = (current.narration + " " + line).strip()

        if current is not None:
            rows.append(current)

        # Date sanity (do not drop)
        _ = [self._safe_date(r.txn_date_str) for r in rows]
        return rows

    @staticmethod
    def _safe_date(s: str):
        try:
            return parse_date(s)
        except Exception:
            return None
