from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.enums import JobStatus, WorkbookStatus
from app.models.job import Job
from app.models.transaction import Transaction
from app.models.workbook_export import WorkbookExport
from app.utils.config_loader import parse_yaml_text
from app.workbook.exporter import write_workbook


class ExportService:
    def __init__(self, db: Session, export_dir: Path):
        self.db = db
        self.export_dir = export_dir

    def export_job_workbook(self, job_id: str) -> WorkbookExport:
        job = self.db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise ValueError("job not found")

        txns = self.db.query(Transaction).filter(Transaction.job_id == job_id).order_by(Transaction.account_id, Transaction.txn_order).all()
        if not txns:
            raise ValueError("no transactions for job")

        by_account: dict[str, list[Transaction]] = defaultdict(list)
        for t in txns:
            key = t.account.account_key if t.account else f"{t.source_bank}-UNKNOWN"
            by_account[key].append(t)

        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        out_path = self.export_dir / f"{job_id}_{stamp}.xlsx"
        write_workbook(
            out_path,
            by_account,
            job_name=job.name,
            case_context=parse_yaml_text(job.notes),
        )

        export = WorkbookExport(job_id=job_id, file_path=str(out_path), status=WorkbookStatus.CREATED)
        self.db.add(export)
        job.status = JobStatus.EXPORTED
        self.db.commit()
        self.db.refresh(export)
        return export
