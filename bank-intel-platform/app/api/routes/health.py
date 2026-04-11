from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.api.deps import app_settings
from app.core.settings import Settings
from app.db.init_db import init_db
from app.db.session import SessionLocal

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "bank-intel-platform"}


@router.get("/ready")
def readiness(settings: Settings = Depends(app_settings)) -> dict[str, object]:
    init_db()
    checks: dict[str, object] = {
        "status": "ok",
        "service": settings.app_name,
        "env": settings.env,
        "database": "ok",
        "upload_dir": str(settings.upload_path.resolve()),
        "export_dir": str(settings.export_path.resolve()),
    }
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()
    return checks
