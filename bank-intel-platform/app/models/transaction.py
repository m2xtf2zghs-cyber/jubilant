from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import Direction
from app.models.mixins import TimestampMixin


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    source_file_id: Mapped[int] = mapped_column(ForeignKey("source_files.id", ondelete="SET NULL"), nullable=True)

    source_file: Mapped[str] = mapped_column(Text, nullable=False)
    source_bank: Mapped[str] = mapped_column(String(64), nullable=False)
    source_account_no: Mapped[str] = mapped_column(String(64), nullable=True)
    source_account_name: Mapped[str] = mapped_column(String(255), nullable=True)
    source_account_type: Mapped[str] = mapped_column(String(32), nullable=True)

    page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    line_ref: Mapped[int] = mapped_column(Integer, nullable=False)
    txn_order: Mapped[int] = mapped_column(Integer, nullable=False)

    txn_date: Mapped[date] = mapped_column(Date, nullable=True, index=True)
    value_date: Mapped[date] = mapped_column(Date, nullable=True)
    cheque_no: Mapped[str] = mapped_column(String(64), nullable=True)

    raw_narration: Mapped[str] = mapped_column(Text, nullable=False)
    cleaned_narration: Mapped[str] = mapped_column(Text, nullable=False)

    debit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    credit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=True)
    direction: Mapped[str] = mapped_column(String(16), default=Direction.ZERO.value, nullable=False)
    month_key: Mapped[str] = mapped_column(String(16), nullable=False)

    inferred_party: Mapped[str] = mapped_column(String(255), nullable=True)
    normalized_party: Mapped[str] = mapped_column(String(255), nullable=True)
    counterparty_type: Mapped[str] = mapped_column(String(64), nullable=True)

    txn_channel: Mapped[str] = mapped_column(String(32), nullable=True)
    txn_purpose: Mapped[str] = mapped_column(String(64), nullable=True)

    classification_primary: Mapped[str] = mapped_column(String(64), default="UNKNOWN", nullable=False, index=True)
    classification_secondary: Mapped[str] = mapped_column(String(255), nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    bank_fin_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    private_fin_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    return_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    doubt_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    odd_figure_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sister_concern_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    linked_entity: Mapped[str] = mapped_column(String(255), nullable=True)
    linked_loan_account: Mapped[str] = mapped_column(String(128), nullable=True)
    expected_cycle_date: Mapped[date] = mapped_column(Date, nullable=True)
    actual_cycle_date: Mapped[date] = mapped_column(Date, nullable=True)
    delay_days: Mapped[int] = mapped_column(Integer, nullable=True)

    parse_notes: Mapped[str] = mapped_column(Text, nullable=True)
    analyst_notes: Mapped[str] = mapped_column(Text, nullable=True)
    overridden_by_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    job = relationship("Job", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
