from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    account_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    source_bank: Mapped[str] = mapped_column(String(64), nullable=False)
    source_account_no: Mapped[str] = mapped_column(String(64), nullable=True)
    source_account_name: Mapped[str] = mapped_column(String(255), nullable=True)
    source_account_type: Mapped[str] = mapped_column(String(32), nullable=True)

    job = relationship("Job", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
