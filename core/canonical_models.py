from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


TYPE_CODES = (
    "SALES",
    "PURCHASE",
    "SIS CON",
    "CASH",
    "BANK FIN",
    "PVT FIN",
    "ODD FIG",
    "DOUBT",
    "RETURN",
    "EXPENSE",
    "INSURANCE",
)


@dataclass
class CanonicalTransaction:
    txn_uid: str
    source_file: str
    source_page: int
    source_line: int
    statement_order: int

    bank_name: str
    account_holder: str
    account_no_masked: str
    account_type: str
    account_id: str

    txn_date: date
    month_label: str

    narration_raw: str
    narration_norm: str

    cheque_no: str | None
    ref_no: str | None
    utr: str | None

    dr_amount: float
    cr_amount: float
    balance: float | None

    channel: str

    type_code: str = "DOUBT"
    category_clean: str = "DOUBT"
    rule_id: str = "UNCLASSIFIED"
    confidence: str = "LOW"
    matched_tokens: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)

    uw_bucket: str = "OK"
    uw_score: int = 100
    uw_reasons: list[str] = field(default_factory=list)
    uw_tags: list[str] = field(default_factory=list)
    uw_amt_risk: float = 0.0
    uw_counterparty_risk: str = "LOW"
    uw_notes: str = ""

    override_applied: bool = False


@dataclass
class AccountBundle:
    account_id: str
    bank_name: str
    account_holder: str
    account_no_masked: str
    account_type: str
    source_file: str
    transactions: list[CanonicalTransaction]


@dataclass
class ReconIssue:
    severity: str
    code: str
    message: str
    source_file: str
    page_no: int | None = None
    line_no: int | None = None
    txn_uid: str | None = None


@dataclass
class ReconSummary:
    account_id: str
    source_file: str
    expected_rows: int
    parsed_rows: int
    total_dr: float
    total_cr: float
    balance_breaks: int
    date_failures: int
    status: str
    notes: str
