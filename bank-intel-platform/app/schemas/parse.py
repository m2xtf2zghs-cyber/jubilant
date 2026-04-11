from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class IntegritySignalResponse(BaseModel):
    code: str
    severity: str
    message: str


class PdfIntegrityResponse(BaseModel):
    file_name: str
    verdict: str
    score: int
    confidence: float
    summary: str
    page_count: int
    text_page_count: int
    image_only_page_count: int
    is_encrypted: bool
    has_digital_signature: bool
    has_incremental_updates: bool
    creator: str | None = None
    producer: str | None = None
    creation_date: str | None = None
    mod_date: str | None = None
    signals: list[IntegritySignalResponse]


class ParseJobResponse(BaseModel):
    job_id: str
    status: str
    files: list[str]
    integrity_results: list[PdfIntegrityResponse] | None = None


class ParseExceptionResponse(BaseModel):
    id: int
    source_file: str
    page_no: int | None
    line_ref: int | None
    severity: str
    code: str
    message: str

    model_config = {"from_attributes": True}


class AccountSummary(BaseModel):
    account_key: str
    source_bank: str
    source_account_no: str | None
    source_account_name: str | None
    source_account_type: str | None
    txn_count: int
    debit_total: float
    credit_total: float


class ParsedTransactionResponse(BaseModel):
    id: int
    account_id: int | None
    source_bank: str
    source_account_no: str | None
    source_account_name: str | None = None
    source_account_type: str | None = None
    page_no: int
    line_ref: int
    txn_date: date | None
    cheque_no: str | None
    raw_narration: str
    cleaned_narration: str
    debit: float
    credit: float
    balance: float | None
    txn_channel: str | None
    txn_purpose: str | None
    normalized_party: str | None
    classification_primary: str
    classification_secondary: str | None
    confidence_score: float
    analyst_notes: str | None = None
    overridden_by_user: bool = False

    model_config = {"from_attributes": True}
