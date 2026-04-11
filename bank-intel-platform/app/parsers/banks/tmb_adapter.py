from __future__ import annotations

import re

from app.parsers.interfaces import ParsedStatement, PdfDocument, RawTransactionRow, StatementMetadata
from app.utils.text import normalize_space


DATE_BALANCE_RE = re.compile(
    r"^\s*(?P<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(?P<bal>-?\d[\d,]*\.\d{2})\s*$",
    re.IGNORECASE,
)
AMOUNT_RE = re.compile(r"-?\d[\d,]*\.\d{2}")
HEADER_RE = re.compile(r"TXN\.\s*DATE.*TRANSACTION\s+REMARKS.*DEBIT.*CREDIT.*ACCOUNT\s+BALANCE", re.IGNORECASE)


class TmbAdapter:
    code = "TMB"

    def detect_score(self, doc: PdfDocument, config: dict) -> float:
        patterns = config.get("bank_patterns", {}).get("TMB", {})
        tokens = [str(t).upper() for t in patterns.get("detect_tokens", ["TAMILNAD MERCANTILE BANK", "TMB"])]
        sample = "\n".join(ln for p in doc.pages[:2] for ln in p.lines[:60]).upper()
        score = 0.0
        for tok in tokens:
            if tok in sample:
                score += 0.45
        if "TRANSACTIONS LIST - CAFLX-" in sample or "TRANSACTIONS LIST - ODGEN-" in sample:
            score += 0.35
        if "TXN. DATE TRANSACTION REMARKS DEBIT CREDIT ACCOUNT BALANCE" in sample:
            score += 0.35
        return min(score, 1.0)

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement:
        _ = config
        meta = self._extract_metadata(doc)
        rows: list[RawTransactionRow] = []

        started = False
        pending_lines: list[str] = []
        txn_order = 0
        pending_page = 1
        pending_line = 1

        for page in doc.pages:
            for line_no, raw_line in enumerate(page.lines, start=1):
                line = normalize_space(raw_line)
                if not line:
                    continue

                if not started:
                    if HEADER_RE.search(line):
                        started = True
                    continue

                if self._is_noise_line(line):
                    continue

                m = DATE_BALANCE_RE.match(line)
                if m:
                    if not pending_lines:
                        continue
                    txn_order += 1
                    date_text = m.group("date")
                    balance_text = m.group("bal")

                    cheque_no, amount_text, narration = self._parse_pending(pending_lines)
                    rows.append(
                        RawTransactionRow(
                            txn_order=txn_order,
                            page_no=pending_page,
                            line_ref=pending_line,
                            txn_date_text=date_text,
                            value_date_text=None,
                            cheque_no=cheque_no,
                            narration=narration,
                            debit_text=None,
                            credit_text=None,
                            amount_text=amount_text,
                            balance_text=balance_text,
                        )
                    )
                    pending_lines = []
                    continue

                if not pending_lines:
                    pending_page = page.page_no
                    pending_line = line_no
                pending_lines.append(line)

        return ParsedStatement(source_file=doc.source_file, metadata=meta, rows=rows)

    @staticmethod
    def _is_noise_line(line: str) -> bool:
        up = line.upper()
        if up.startswith("PAGE ") or "OPERATIVE ACCOUNTS" in up:
            return True
        if up in {"NO.", "NO"}:
            return True
        if up in {"AFFAN", "VEERA"}:
            return True
        if "MY TRANSACTIONS" in up:
            return True
        return False

    @staticmethod
    def _parse_pending(lines: list[str]) -> tuple[str | None, str | None, str]:
        text = normalize_space(" ".join(lines))
        words = text.split()
        cheque_no = None
        if words and words[0].isdigit() and len(words[0]) <= 10:
            cheque_no = words[0]
            text = normalize_space(" ".join(words[1:]))

        amounts = AMOUNT_RE.findall(text)
        amount_text = amounts[-1] if amounts else None
        narration = text
        if amount_text:
            narration = re.sub(rf"\s*{re.escape(amount_text)}\s*$", "", narration).strip()
        return cheque_no, amount_text, narration

    @staticmethod
    def _extract_metadata(doc: PdfDocument) -> StatementMetadata:
        sample_lines = [ln for p in doc.pages[:2] for ln in p.lines]
        sample = "\n".join(sample_lines)
        sample_up = sample.upper()

        meta = StatementMetadata(source_bank="TMB")

        # "AFFAN METALS Account Number : 210150..."
        m = re.search(r"(?im)^\s*([A-Z0-9 .,&()/\-]+?)\s+ACCOUNT\s+NUMBER\s*:\s*([0-9]{9,20})\s*$", sample_up)
        if m:
            meta.source_account_name = normalize_space(m.group(1))
            meta.source_account_no = m.group(2)
        else:
            m2 = re.search(r"(?i)\bACCOUNT\s+NUMBER\s*:\s*([0-9]{9,20})\b", sample)
            if m2:
                meta.source_account_no = m2.group(1)

        if "TRANSACTIONS LIST - CAFLX-" in sample_up:
            meta.source_account_type = "CA"
        elif "TRANSACTIONS LIST - ODGEN-" in sample_up:
            meta.source_account_type = "OD"
        elif "TRANSACTIONS LIST - CC" in sample_up:
            meta.source_account_type = "CC"
        elif "TRANSACTIONS LIST - SB" in sample_up:
            meta.source_account_type = "SA"

        return meta
