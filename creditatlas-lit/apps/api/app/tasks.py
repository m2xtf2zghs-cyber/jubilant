from __future__ import annotations

from celery import Celery

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.ingestion import process_vendor_payload

celery_app = Celery(
    "creditatlas_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)


@celery_app.task(name="app.tasks.ingest_finbox_payload")
def ingest_finbox_payload(payload_id: str, triggered_by_user_id: str | None = None) -> dict:
    with SessionLocal() as db:
        return process_vendor_payload(db, payload_id, triggered_by_user_id)
