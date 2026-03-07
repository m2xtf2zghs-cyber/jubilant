from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    email: str
    full_name: str
    role: str


class BorrowerCreate(BaseModel):
    name: str
    industry: str | None = None
    constitution: str | None = None
    gstin: str | None = None
    pan: str | None = None


class BorrowerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    name: str
    industry: str | None
    constitution: str | None
    gstin: str | None
    pan: str | None
    created_at: datetime


class CaseCreate(BaseModel):
    borrower_id: str
    status: str = "OPEN"


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    borrower_id: str
    org_id: str
    analyst_user_id: str
    status: str
    months_analyzed: int
    accounts_analyzed: int
    decision_badge: str
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    file_name: str
    object_key: str
    content_type: str | None
    size_bytes: int | None
    created_at: datetime


class FinboxIngestionRequest(BaseModel):
    external_reference: str = Field(min_length=3, max_length=120)
    payload: dict[str, Any]


class IngestionStatusOut(BaseModel):
    payload_id: str
    external_reference: str
    status: str
    error_message: str | None
    updated_at: datetime


class ReprocessResponse(BaseModel):
    payload_id: str
    status: str


class TransactionOut(BaseModel):
    id: str
    txn_date: date
    amount: float
    direction: str
    narration_clean: str
    counterparty_name: str | None
    category_internal: str | None
    source_vendor: str


class MonthlySummaryRow(BaseModel):
    month: str
    credits: float
    debits: float
    net: float


class CounterpartyOut(BaseModel):
    id: str
    canonical_name: str
    total_credits: float
    total_debits: float
    txn_count: int


class EmiOut(BaseModel):
    lender_name: str
    monthly_amount_estimate: float
    first_seen: date
    last_seen: date
    expected_day_of_month: int
    delay_days_by_month: dict[str, int]
    missed_months: list[str]
    confidence: float


class StreetLenderOut(BaseModel):
    lender_name: str
    confidence: float
    avg_credit_size: float
    avg_repayment_size: float
    avg_cycle_days: float
    estimated_principal: float
    estimated_monthly_interest_burden: float
    pattern_type: str


class TruthOut(BaseModel):
    period_month: str
    gross_credits: float
    internal_transfers_excluded: float
    finance_credits_excluded: float
    other_non_business_excluded: float
    adjusted_business_credits: float
    truth_confidence: float


class CreditBrainOut(BaseModel):
    decision: str
    grade: str
    truth_score: float
    stress_score: float
    fraud_score: float
    suggested_exposure_min: float
    suggested_exposure_max: float
    key_positives: list[str]
    key_concerns: list[str]
    conditions_precedent: list[str]
    narrative: str


class CaseSummaryOut(BaseModel):
    case_id: str
    borrower_name: str
    industry: str | None
    constitution: str | None
    months_analyzed: int
    accounts_analyzed: int
    decision_badge: str
    kpis: dict[str, float | str]
    risk_flags: list[dict[str, Any]]
