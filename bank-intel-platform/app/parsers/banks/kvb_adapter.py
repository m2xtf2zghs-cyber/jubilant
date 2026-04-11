from __future__ import annotations

import re

from app.parsers.banks.token_adapter import TokenBankAdapter
from app.parsers.interfaces import ParsedStatement, PdfDocument, RawTransactionRow
from app.utils.text import normalize_space


DATE_START_RE = re.compile(r"^\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b")
AMOUNT_RE = re.compile(r"-?\d[\d,]*\.\d{2}")
NEW_TXN_HEAD_RE = re.compile(
    r"(?i)^\s*(?:NEFT|RTGS|IMPS|UPI|OMN/TO|ACH|ACHINWDR|IBRTGS|IBNEFT|CLEARING|TRANSFER|CASH|CHQ|LOAN|INTERBR)\b"
)


def _is_noise(line: str) -> bool:
    up = line.upper()
    if not up:
        return True
    if up.startswith("PAGE ") or " OF " in up and up.startswith("PAGE"):
        return True
    if up.startswith("DATE PARTICULARS") or up.startswith("(INR)"):
        return True
    if up.startswith("OPENING BALANCE"):
        return True
    return False


def _looks_like_new_txn_head(line: str) -> bool:
    return bool(NEW_TXN_HEAD_RE.search(line))


class KvbAdapter(TokenBankAdapter):
    code = "KVB"

    def __init__(self) -> None:
        super().__init__(code="KVB", detect_tokens=("KARUR VYSYA BANK", "KVB", "KARB", "KBL"))

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        parsed = super().parse(doc, config)
        parsed.metadata.source_bank = "KVB"

        # KVB/KARB PDFs frequently place narration before the date+amount line.
        rows: list[RawTransactionRow] = []
        current: RawTransactionRow | None = None
        pending_narration: list[str] = []
        order = 0

        for page in doc.pages:
            for line_no, raw_line in enumerate(page.lines, start=1):
                line = normalize_space(raw_line)
                if _is_noise(line):
                    continue

                dm = DATE_START_RE.match(line)
                if dm:
                    if current is not None:
                        rows.append(current)
                    order += 1
                    dt = dm.group(1)
                    tail = re.sub(r"^\s*" + re.escape(dt) + r"\s*", "", line).strip()
                    nums = AMOUNT_RE.findall(tail)
                    amount_text = nums[-2] if len(nums) >= 2 else (nums[-1] if nums else None)
                    balance_text = nums[-1] if nums else None
                    desc_inline = tail
                    if balance_text:
                        desc_inline = re.sub(rf"\s*{re.escape(balance_text)}\s*$", "", desc_inline).strip()
                    if amount_text:
                        desc_inline = re.sub(rf"\s*{re.escape(amount_text)}\s*$", "", desc_inline).strip()
                    narration_parts = [*pending_narration]
                    if desc_inline:
                        narration_parts.append(desc_inline)
                    pending_narration = []
                    current = RawTransactionRow(
                        txn_order=order,
                        page_no=page.page_no,
                        line_ref=line_no,
                        txn_date_text=dt,
                        value_date_text=None,
                        cheque_no=None,
                        narration=normalize_space(" ".join(narration_parts)),
                        debit_text=None,
                        credit_text=None,
                        amount_text=amount_text,
                        balance_text=balance_text,
                    )
                    continue

                if current is None:
                    pending_narration.append(line)
                else:
                    if _looks_like_new_txn_head(line):
                        pending_narration.append(line)
                    else:
                        current.narration = normalize_space(f"{current.narration} {line}")

        if current is not None:
            rows.append(current)
        if rows:
            parsed.rows = rows

        if not parsed.metadata.source_account_type:
            sample = "\n".join(p.text for p in doc.pages[:2]).upper()
            if "OPENING BALANCE -" in sample or "OVERDRAFT" in sample:
                parsed.metadata.source_account_type = "OD"

        return parsed
