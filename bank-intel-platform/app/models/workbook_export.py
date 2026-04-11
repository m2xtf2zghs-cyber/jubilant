from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import WorkbookStatus
from app.models.mixins import TimestampMixin


class WorkbookExport(Base, TimestampMixin):
    __tablename__ = "workbook_exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WorkbookStatus] = mapped_column(Enum(WorkbookStatus), default=WorkbookStatus.CREATED, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    job = relationship("Job", back_populates="workbook_exports")
