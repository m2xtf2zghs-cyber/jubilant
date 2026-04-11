from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.aliases import router as aliases_router
from app.api.routes.exports import router as exports_router
from app.api.routes.health import router as health_router
from app.api.routes.integrity import router as integrity_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.overrides import router as overrides_router
from app.api.routes.parsing import router as parsing_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(integrity_router)
api_router.include_router(jobs_router)
api_router.include_router(parsing_router)
api_router.include_router(overrides_router)
api_router.include_router(aliases_router)
api_router.include_router(exports_router)
