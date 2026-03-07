from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


def new_id() -> str:
    return str(uuid.uuid4())


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("org_id", "email", name="uq_users_org_email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    organization = relationship("Organization")


class Borrower(Base, TimestampMixin):
    __tablename__ = "borrowers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(255))
    constitution: Mapped[str | None] = mapped_column(String(120))
    gstin: Mapped[str | None] = mapped_column(String(20))
    pan: Mapped[str | None] = mapped_column(String(20))


class LoanCase(Base, TimestampMixin):
    __tablename__ = "loan_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    borrower_id: Mapped[str] = mapped_column(String(36), ForeignKey("borrowers.id"), index=True)
    analyst_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="OPEN")
    months_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    accounts_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    decision_badge: Mapped[str] = mapped_column(String(40), default="PENDING")

    borrower = relationship("Borrower")


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))


class BankAccount(Base, TimestampMixin):
    __tablename__ = "bank_accounts"
    __table_args__ = (
        UniqueConstraint("case_id", "source_vendor", "external_id", name="uq_bank_account_external"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    bank_name: Mapped[str | None] = mapped_column(String(255))
    account_number_masked: Mapped[str | None] = mapped_column(String(64))
    ifsc: Mapped[str | None] = mapped_column(String(20))
    holder_name: Mapped[str | None] = mapped_column(String(255))
    source_vendor: Mapped[str] = mapped_column(String(50), default="FINBOX")
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)


class BankStatement(Base, TimestampMixin):
    __tablename__ = "bank_statements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    account_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bank_accounts.id"), index=True)
    source_vendor: Mapped[str] = mapped_column(String(50), default="FINBOX")
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(40), default="QUEUED")
    last_ingested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VendorPayload(Base, TimestampMixin):
    __tablename__ = "vendor_payloads"
    __table_args__ = (
        UniqueConstraint(
            "case_id",
            "provider_name",
            "payload_type",
            "external_reference",
            name="uq_vendor_payload_idempotency",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    provider_name: Mapped[str] = mapped_column(String(60), nullable=False)
    payload_type: Mapped[str] = mapped_column(String(60), nullable=False)
    external_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="QUEUED")
    error_message: Mapped[str | None] = mapped_column(Text)


class BankTransactionRaw(Base, TimestampMixin):
    __tablename__ = "bank_transactions_raw"
    __table_args__ = (
        UniqueConstraint(
            "case_id", "account_id", "external_txn_id", name="uq_raw_txn_external_dedupe"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    account_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bank_accounts.id"), index=True)
    vendor_payload_id: Mapped[str] = mapped_column(String(36), ForeignKey("vendor_payloads.id"), index=True)
    external_txn_id: Mapped[str] = mapped_column(String(120), nullable=False)
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    narration: Mapped[str] = mapped_column(Text, nullable=False)
    balance_after: Mapped[float | None] = mapped_column(Numeric(14, 2))
    counterparty_name: Mapped[str | None] = mapped_column(String(255))
    mode: Mapped[str | None] = mapped_column(String(60))
    category_vendor: Mapped[str | None] = mapped_column(String(120))
    vendor_confidence: Mapped[float | None] = mapped_column(Float)
    source_vendor: Mapped[str] = mapped_column(String(50), default="FINBOX")


class Counterparty(Base, TimestampMixin):
    __tablename__ = "counterparties"
    __table_args__ = (UniqueConstraint("case_id", "canonical_name", name="uq_counterparty_canonical"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(60), default="UNKNOWN")
    first_seen: Mapped[date | None] = mapped_column(Date)
    last_seen: Mapped[date | None] = mapped_column(Date)
    total_credits: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_debits: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    txn_count: Mapped[int] = mapped_column(Integer, default=0)


class CounterpartyAlias(Base, TimestampMixin):
    __tablename__ = "counterparty_aliases"
    __table_args__ = (
        UniqueConstraint("case_id", "alias_name", name="uq_counterparty_alias_name"),
        Index("ix_counterparty_alias_case_counterparty", "case_id", "counterparty_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    counterparty_id: Mapped[str] = mapped_column(String(36), ForeignKey("counterparties.id"), index=True)
    alias_name: Mapped[str] = mapped_column(String(255), nullable=False)
    match_method: Mapped[str] = mapped_column(String(40), default="DETERMINISTIC")


class BankTransactionNormalized(Base, TimestampMixin):
    __tablename__ = "bank_transactions_normalized"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    account_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bank_accounts.id"), index=True)
    raw_txn_id: Mapped[str] = mapped_column(String(36), ForeignKey("bank_transactions_raw.id"), index=True)
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)
    value_date: Mapped[date | None] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    narration_raw: Mapped[str] = mapped_column(Text, nullable=False)
    narration_clean: Mapped[str] = mapped_column(Text, nullable=False)
    counterparty_name: Mapped[str | None] = mapped_column(String(255))
    counterparty_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("counterparties.id"), index=True)
    mode: Mapped[str | None] = mapped_column(String(60))
    category_vendor: Mapped[str | None] = mapped_column(String(120))
    category_internal: Mapped[str | None] = mapped_column(String(120))
    balance_after: Mapped[float | None] = mapped_column(Numeric(14, 2))
    source_vendor: Mapped[str] = mapped_column(String(50), default="FINBOX")
    vendor_confidence: Mapped[float | None] = mapped_column(Float)


class EmiObligation(Base, TimestampMixin):
    __tablename__ = "emi_obligations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    counterparty_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("counterparties.id"), index=True)
    lender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    monthly_amount_estimate: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    first_seen: Mapped[date] = mapped_column(Date, nullable=False)
    last_seen: Mapped[date] = mapped_column(Date, nullable=False)
    expected_day_of_month: Mapped[int] = mapped_column(Integer, nullable=False)
    delay_days_by_month: Mapped[dict] = mapped_column(JSON, default=dict)
    missed_months: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)


class PrivateLenderSignal(Base, TimestampMixin):
    __tablename__ = "private_lender_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    counterparty_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("counterparties.id"), index=True)
    lender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    avg_credit_size: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    avg_repayment_size: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    avg_cycle_days: Mapped[float] = mapped_column(Float, default=0)
    estimated_principal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    estimated_monthly_interest_burden: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    pattern_type: Mapped[str] = mapped_column(String(80), default="ROUND_TRIP")
    signal_payload: Mapped[dict] = mapped_column(JSON, default=dict)


class TruthEngineResult(Base, TimestampMixin):
    __tablename__ = "truth_engine_results"
    __table_args__ = (UniqueConstraint("case_id", "period_month", name="uq_truth_case_period"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    period_month: Mapped[str] = mapped_column(String(7), nullable=False)
    gross_credits: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    internal_transfers_excluded: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    finance_credits_excluded: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    other_non_business_excluded: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    adjusted_business_credits: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    truth_confidence: Mapped[float] = mapped_column(Float, default=0)
    explain_payload: Mapped[dict] = mapped_column(JSON, default=dict)


class CreditBrainResult(Base, TimestampMixin):
    __tablename__ = "credit_brain_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True, unique=True)
    decision: Mapped[str] = mapped_column(String(40), nullable=False)
    grade: Mapped[str] = mapped_column(String(10), nullable=False)
    truth_score: Mapped[float] = mapped_column(Float, nullable=False)
    stress_score: Mapped[float] = mapped_column(Float, nullable=False)
    fraud_score: Mapped[float] = mapped_column(Float, nullable=False)
    suggested_exposure_min: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    suggested_exposure_max: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    key_positives: Mapped[list] = mapped_column(JSON, default=list)
    key_concerns: Mapped[list] = mapped_column(JSON, default=list)
    conditions_precedent: Mapped[list] = mapped_column(JSON, default=list)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    explain_payload: Mapped[dict] = mapped_column(JSON, default=dict)


class RiskFlag(Base, TimestampMixin):
    __tablename__ = "risk_flags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metric_value: Mapped[float | None] = mapped_column(Float)
    context: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("loan_cases.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(36))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
