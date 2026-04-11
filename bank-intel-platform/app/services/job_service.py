from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.source_file import SourceFile
from app.models.enums import FileStatus, JobStatus
from app.utils.ids import job_id


class JobService:
    def __init__(self, db: Session):
        self.db = db

    def create_job(self, name: str, files: list[tuple[str, str]], notes: str | None = None) -> Job:
        job = Job(id=job_id(), name=name, status=JobStatus.QUEUED, input_count=len(files), notes=notes)
        self.db.add(job)
        self.db.flush()

        for original_name, stored_path in files:
            sf = SourceFile(
                job_id=job.id,
                original_name=original_name,
                stored_path=stored_path,
                status=FileStatus.UPLOADED,
            )
            self.db.add(sf)

        self.db.commit()
        self.db.refresh(job)
        return job

    def list_jobs(self) -> list[Job]:
        return self.db.query(Job).order_by(Job.created_at.desc()).all()

    def get_job(self, job_id: str) -> Job | None:
        return self.db.query(Job).filter(Job.id == job_id).first()

    def update_notes(self, job_id: str, notes: str | None) -> Job | None:
        job = self.get_job(job_id)
        if job is None:
            return None
        job.notes = notes
        self.db.commit()
        self.db.refresh(job)
        return job
