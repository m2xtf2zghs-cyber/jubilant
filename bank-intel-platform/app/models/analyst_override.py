from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class AnalystOverride(Base, TimestampMixin):
    __tablename__ = "analyst_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    classification_primary: Mapped[str] = mapped_column(String(64), nullable=False)
    classification_secondary: Mapped[str] = mapped_column(String(255), nullable=True)
    normalized_party: Mapped[str] = mapped_column(String(255), nullable=True)
    analyst_notes: Mapped[str] = mapped_column(Text, nullable=True)

    job = relationship("Job", back_populates="overrides")
