from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import JobStatus
from app.models.mixins import TimestampMixin


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.QUEUED, nullable=False)
    input_count: Mapped[int] = mapped_column(default=0, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    source_files = relationship("SourceFile", back_populates="job", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="job", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="job", cascade="all, delete-orphan")
    exceptions = relationship("ParseException", back_populates="job", cascade="all, delete-orphan")
    overrides = relationship("AnalystOverride", back_populates="job", cascade="all, delete-orphan")
    workbook_exports = relationship("WorkbookExport", back_populates="job", cascade="all, delete-orphan")
