from __future__ import annotations

import re

from app.parsers.interfaces import RawTransactionRow

DATE_TOKEN_RE = re.compile(r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b")
CHEQUE_TOKEN_RE = re.compile(r"(?i)\b(?:CHQ|CHEQUE|CHQ/REF|REF)\s*(?:NO|NUMBER)?[:\-/ ]*([A-Z0-9]{4,24})\b")
VALUE_DATE_PREFIX_RE = re.compile(r"^\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+")
NOISE_RE = re.compile(
    r"(?i)\b(?:WITHDRAWAL(?:\s+AMT)?|DEPOSIT(?:\s+AMT)?|CLOSING\s+BALANCE|OPENING\s+BALANCE|VALUE\s+DT|VALUE\s+DATE)\b"
)
AXIS_AMT_IND_BAL_RE = re.compile(
    r"(?i)\b(?P<amt>\d[\d,]*\.\d{2})\s*(?P<ind>DR|CR|DEBIT|CREDIT)\s*(?P<bal>\d[\d,]*\.\d{2})\b"
)


def refine_common_row(row: RawTransactionRow) -> RawTransactionRow:
    narration = (row.narration or "").strip()
    if not narration:
        return row

    # Capture value date if it appears at the start of narration after parsing.
    if not row.value_date_text:
        m = VALUE_DATE_PREFIX_RE.match(narration)
        if m:
            row.value_date_text = m.group(1)
            narration = narration[m.end() :].strip()

    # Extract cheque/ref if present and unset.
    if not row.cheque_no:
        m = CHEQUE_TOKEN_RE.search(narration)
        if m:
            row.cheque_no = m.group(1)

    # Remove common header artifacts if OCR/text merge leaked them.
    narration = NOISE_RE.sub(" ", narration)
    narration = re.sub(r"\s+", " ", narration).strip(" -|:/")
    row.narration = narration
    return row


def refine_axis_drcr_indicator(row: RawTransactionRow) -> RawTransactionRow:
    """
    Axis statements sometimes provide amount + DR/CR indicator instead of split debit/credit columns.
    If parser captured single amount, map it into debit/credit when indicator is visible in narration.
    """
    n = (row.narration or "").upper()
    m = AXIS_AMT_IND_BAL_RE.search(row.narration or "")
    if m:
        amt = m.group("amt")
        ind = m.group("ind").upper()
        bal = m.group("bal")
        row.balance_text = row.balance_text or bal
        if ind in {"DR", "DEBIT"}:
            row.debit_text = row.debit_text or amt
            row.credit_text = row.credit_text or None
        else:
            row.credit_text = row.credit_text or amt
            row.debit_text = row.debit_text or None
        row.amount_text = None
        row.narration = re.sub(re.escape(m.group(0)), " ", row.narration or "", flags=re.IGNORECASE)
        row.narration = re.sub(r"\s+", " ", row.narration).strip()
        return row

    if row.debit_text or row.credit_text or not row.amount_text:
        return row
    if re.search(r"\bDR\b|\bDEBIT\b|\bWITHDRAWAL\b", n):
        row.debit_text = row.amount_text
        row.amount_text = None
    elif re.search(r"\bCR\b|\bCREDIT\b|\bDEPOSIT\b", n):
        row.credit_text = row.amount_text
        row.amount_text = None
    return row
