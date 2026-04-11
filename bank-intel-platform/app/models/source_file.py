from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import FileStatus
from app.models.mixins import TimestampMixin


class SourceFile(Base, TimestampMixin):
    __tablename__ = "source_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_path: Mapped[str] = mapped_column(Text, nullable=False)
    source_bank: Mapped[str] = mapped_column(String(64), nullable=True)
    status: Mapped[FileStatus] = mapped_column(Enum(FileStatus), default=FileStatus.UPLOADED, nullable=False)
    page_count: Mapped[int] = mapped_column(default=0, nullable=False)

    job = relationship("Job", back_populates="source_files")
