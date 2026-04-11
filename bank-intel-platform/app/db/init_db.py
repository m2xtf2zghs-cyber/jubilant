from __future__ import annotations

from app.db.base import Base
from app.db.session import engine
from app.models import account, analyst_override, audit_event, entity_master, job, parse_exception, party_alias, source_file, transaction, workbook_export  # noqa: F401


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
