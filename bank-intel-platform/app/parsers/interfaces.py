from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol


@dataclass
class PdfPage:
    page_no: int
    text: str
    lines: list[str]


@dataclass
class StatementMetadata:
    source_bank: str | None = None
    source_account_no: str | None = None
    source_account_name: str | None = None
    source_account_type: str | None = None
    period_from: date | None = None
    period_to: date | None = None


@dataclass
class PdfDocument:
    source_file: str
    pages: list[PdfPage]
    metadata: StatementMetadata = field(default_factory=StatementMetadata)


@dataclass
class RawTransactionRow:
    txn_order: int
    page_no: int
    line_ref: int
    txn_date_text: str
    value_date_text: str | None
    cheque_no: str | None
    narration: str
    debit_text: str | None
    credit_text: str | None
    amount_text: str | None
    balance_text: str | None


@dataclass
class ParsedStatement:
    source_file: str
    metadata: StatementMetadata
    rows: list[RawTransactionRow]


class BankAdapter(Protocol):
    code: str

    def detect_score(self, doc: PdfDocument, config: dict) -> float: ...

    def parse(self, doc: PdfDocument, config: dict) -> ParsedStatement: ...
