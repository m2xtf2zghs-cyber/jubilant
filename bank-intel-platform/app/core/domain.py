from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class CanonicalTransaction(BaseModel):
    id: int | None = None
    job_id: str
    source_file: str
    source_bank: str
    source_account_no: str | None = None
    source_account_name: str | None = None
    source_account_type: str | None = None
    page_no: int
    line_ref: int
    txn_date: date | None = None
    value_date: date | None = None
    cheque_no: str | None = None
    raw_narration: str
    cleaned_narration: str
    debit: float = 0.0
    credit: float = 0.0
    balance: float | None = None
    direction: str = "ZERO"
    month_key: str = "UNKNOWN"
    inferred_party: str | None = None
    normalized_party: str | None = None
    counterparty_type: str | None = None
    txn_channel: str | None = None
    txn_purpose: str | None = None
    classification_primary: str = "UNKNOWN"
    classification_secondary: str | None = None
    confidence_score: float = 0.0
    bank_fin_flag: bool = False
    private_fin_flag: bool = False
    return_flag: bool = False
    doubt_flag: bool = False
    odd_figure_flag: bool = False
    sister_concern_flag: bool = False
    linked_entity: str | None = None
    linked_loan_account: str | None = None
    expected_cycle_date: date | None = None
    actual_cycle_date: date | None = None
    delay_days: int | None = None
    parse_notes: str | None = None
    analyst_notes: str | None = None
    overridden_by_user: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DetectionResult(BaseModel):
    code: str
    flag: bool
    reason: str
    confidence: float = Field(default=0.6, ge=0.0, le=1.0)
