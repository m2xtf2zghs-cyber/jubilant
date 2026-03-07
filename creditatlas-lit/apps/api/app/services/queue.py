from __future__ import annotations

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.ingestion import process_vendor_payload


class QueueUnavailableError(Exception):
    pass


try:
    from celery import Celery

    celery_client = Celery(
        "creditatlas_api",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
    )
except Exception:  # noqa: BLE001
    celery_client = None


def enqueue_finbox_ingestion(payload_id: str, triggered_by_user_id: str) -> str:
    if celery_client is None:
        if settings.allow_inline_ingestion_fallback:
            with SessionLocal() as db:
                process_vendor_payload(db, payload_id, triggered_by_user_id)
            return "PROCESSED_INLINE"
        raise QueueUnavailableError("Celery is not installed or unavailable")

    try:
        celery_client.send_task(
            "app.tasks.ingest_finbox_payload",
            args=[payload_id, triggered_by_user_id],
        )
        return "QUEUED"
    except Exception as exc:  # noqa: BLE001
        if settings.allow_inline_ingestion_fallback:
            with SessionLocal() as db:
                process_vendor_payload(db, payload_id, triggered_by_user_id)
            return "PROCESSED_INLINE"

        raise QueueUnavailableError("Celery broker is unavailable") from exc
