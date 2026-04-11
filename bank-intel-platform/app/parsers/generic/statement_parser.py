from __future__ import annotations

import re
from typing import Optional

from app.parsers.interfaces import BankAdapter, ParsedStatement, PdfDocument, RawTransactionRow, StatementMetadata
from app.utils.money import parse_amount
from app.utils.text import normalize_space


DATE_START = re.compile(r"^\s*(?:\d+\s+)?(?P<d>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b")
AMOUNT_TOKEN = re.compile(r"\(?-?\d[\d,]*(?:\.\d+)?\)?")


class GenericStatementParser(BankAdapter):
    code = "GENERIC"

    def __init__(self, bank_hint: str = "GENERIC"):
        self.bank_hint = bank_hint

    def detect_score(self, doc: PdfDocument, config: dict) -> float:
        _ = config
        if self.bank_hint != "GENERIC":
            return 0.6
        return 0.4

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        _ = config
        meta = self._extract_metadata(doc)
        rows: list[RawTransactionRow] = []
        current: Optional[RawTransactionRow] = None
        order = 0

        for page in doc.pages:
            for i, ln in enumerate(page.lines, start=1):
                line = normalize_space(ln)
                m = DATE_START.match(line)
                if m:
                    if current is not None:
                        rows.append(current)

                    order += 1
                    dt = m.group("d")
                    tail = re.sub(r"^\s*(?:\d+\s+)?" + re.escape(dt) + r"\s*", "", line).strip()
                    debit, credit, amount, balance, cheque, stripped = self._extract_tail(tail)
                    current = RawTransactionRow(
                        txn_order=order,
                        page_no=page.page_no,
                        line_ref=i,
                        txn_date_text=dt,
                        value_date_text=None,
                        cheque_no=cheque,
                        narration=stripped,
                        debit_text=debit,
                        credit_text=credit,
                        amount_text=amount,
                        balance_text=balance,
                    )
                elif current is not None:
                    current.narration = normalize_space(f"{current.narration} {line}")

        if current is not None:
            rows.append(current)

        return ParsedStatement(source_file=doc.source_file, metadata=meta, rows=rows)

    def _extract_metadata(self, doc: PdfDocument) -> StatementMetadata:
        sample = "\n".join(p.text for p in doc.pages[:2]).upper()
        meta = StatementMetadata(source_bank=self.bank_hint)

        m = re.search(r"\bNAME\s*:\s*([A-Z0-9 .,&()/\-]+?)\s+ACCOUNT\s+NO\s*:", sample)
        if m:
            meta.source_account_name = normalize_space(m.group(1))
        m = re.search(r"\bACCOUNT\s+NO\s*:\s*([0-9]{9,20})\b", sample)
        if m:
            meta.source_account_no = m.group(1)
        if not meta.source_account_no:
            m = re.search(r"\bA/?C(?:OUNT)?\s*(?:NO|NUMBER)?\s*[:\-]?\s*([0-9]{9,20})\b", sample)
            if m:
                meta.source_account_no = m.group(1)
        if not meta.source_account_no:
            m = re.search(r"\bSTATEMENT\s+FOR\s+A/?C\s*([0-9]{9,20})\b", sample)
            if m:
                meta.source_account_no = m.group(1)

        if re.search(r"\bACCOUNT\s+TYPE\s*:\s*OVERDRAFT\b|\bOVER\s*DRAFT\b", sample):
            meta.source_account_type = "OD"
        elif re.search(r"\bACCOUNT\s+TYPE\s*:\s*CURRENT\b|\bCURRENT\s+ACCOUNT\b", sample):
            meta.source_account_type = "CA"
        elif re.search(r"\bACCOUNT\s+TYPE\s*:\s*SAVINGS\b|\bSAVINGS\s+ACCOUNT\b", sample):
            meta.source_account_type = "SA"
        elif re.search(r"\bACCOUNT\s+TYPE\s*:\s*CASH\s+CREDIT\b|\bCASH\s+CREDIT\b", sample):
            meta.source_account_type = "CC"

        return meta

    def _extract_tail(self, text: str) -> tuple[str | None, str | None, str | None, str | None, str | None, str]:
        tokens = text.split()
        numeric: list[str] = []
        for tok in reversed(tokens):
            if AMOUNT_TOKEN.fullmatch(tok.replace("₹", "")):
                numeric.append(tok)
                if len(numeric) >= 4:
                    break
            elif numeric:
                break
        numeric = list(reversed(numeric))

        debit = credit = amount = balance = cheque = None
        consumed: list[str] = []
        if numeric:
            balance = numeric[-1]
            consumed.append(balance)
            if len(numeric) >= 3 and numeric[-3].isdigit() and len(numeric[-3]) <= 6:
                cheque = numeric[-3]
                amount = numeric[-2]
                # Keep cheque/reference token in narration for analyst fidelity; still capture separately.
                consumed.append(amount)
            elif len(numeric) >= 3:
                debit = numeric[-3]
                credit = numeric[-2]
                consumed.extend([credit, debit])
            elif len(numeric) == 2:
                amount = numeric[-2]
                consumed.append(amount)

        stripped = text
        for tok in consumed:
            stripped = re.sub(rf"(?:\s+){re.escape(tok)}\s*$", "", stripped)
        return debit, credit, amount, balance, cheque, normalize_space(stripped)

    @staticmethod
    def infer_dr_cr(debit_text: str | None, credit_text: str | None, amount_text: str | None, prev_balance: float | None, curr_balance: float | None) -> tuple[float, float]:
        if debit_text:
            return abs(parse_amount(debit_text)), 0.0
        if credit_text:
            return 0.0, abs(parse_amount(credit_text))
        if not amount_text:
            return 0.0, 0.0

        amt = abs(parse_amount(amount_text))
        if prev_balance is not None and curr_balance is not None:
            delta = round(curr_balance - prev_balance, 2)
            if delta >= 0:
                return 0.0, amt
            return amt, 0.0
        return amt, 0.0
