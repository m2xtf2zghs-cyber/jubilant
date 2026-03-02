from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional, Protocol


@dataclass
class StatementMetadata:
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_no: Optional[str] = None
    account_no_masked: Optional[str] = None
    account_type: Optional[str] = None  # CA/SA/OD/CC if known
    period_from: Optional[date] = None
    period_to: Optional[date] = None
    branch: Optional[str] = None
    ifsc: Optional[str] = None


@dataclass
class PdfPage:
    page_no: int
    text: str
    lines: List[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.lines:
            self.lines = self.text.splitlines()


@dataclass
class PdfDocument:
    filepath: str
    pages: List[PdfPage]
    metadata: StatementMetadata

    @property
    def source_file(self) -> str:
        # Backward compatibility with existing parser/registry code.
        return self.filepath


@dataclass
class RawRow:
    txn_date_str: str
    narration: str
    debit_str: Optional[str]
    credit_str: Optional[str]
    balance_str: Optional[str]
    cheque_ref_str: Optional[str]
    source_page: int
    source_line: int


class BaseBankAdapter(Protocol):
    code: str

    def detect(self, doc: PdfDocument) -> float:
        """Return confidence score 0..1 for this adapter."""
        ...

    def extract_rows(self, doc: PdfDocument) -> List[RawRow]:
        """Extract RawRow list. MUST be line-for-line."""
        ...

    def extract_metadata(self, doc: PdfDocument) -> StatementMetadata:
        """Optional: enrich doc.metadata."""
        ...
