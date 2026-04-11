from __future__ import annotations

import logging
import time
import uuid

from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.settings import Settings
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.models.audit_event import AuditEvent

audit_logger = logging.getLogger("app.audit")


class BearerAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id

        token_list = self.settings.auth_token_list
        request.state.auth_subject = "anonymous"
        if not token_list or self._is_exempt(request.url.path):
            response = await call_next(request)
            response.headers["x-request-id"] = request_id
            return response

        auth_header = request.headers.get("authorization", "")
        scheme, _, token = auth_header.partition(" ")
        if scheme.lower() != "bearer" or token.strip() not in token_list:
            return JSONResponse(status_code=401, content={"detail": "unauthorized", "request_id": request_id})

        request.state.auth_subject = f"token:{token.strip()[:8]}"
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    def _is_exempt(self, path: str) -> bool:
        return any(path == exempt or path.startswith(f"{exempt}/") for exempt in self.settings.exempt_path_list)


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, settings: Settings):
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        request_id = getattr(request.state, "request_id", uuid.uuid4().hex)
        auth_subject = getattr(request.state, "auth_subject", "anonymous")
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - started) * 1000)

        client_ip = request.client.host if request.client else None
        audit_logger.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%s client_ip=%s auth=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            client_ip,
            auth_subject,
        )

        if self.settings.audit_log_db_enabled:
            self._persist_event(
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                query_string=request.url.query or "",
                status_code=int(response.status_code),
                client_ip=client_ip,
                user_agent=request.headers.get("user-agent", ""),
                auth_subject=auth_subject,
                duration_ms=duration_ms,
            )

        response.headers["x-request-id"] = request_id
        return response

    def _persist_event(self, **event_payload: object) -> None:
        for attempt in range(2):
            db = SessionLocal()
            try:
                db.add(AuditEvent(**event_payload))
                db.commit()
                return
            except OperationalError as exc:  # pragma: no cover
                db.rollback()
                message = str(exc).lower()
                if attempt == 0 and ("no such table" in message or "does not exist" in message):
                    init_db()
                    continue
                audit_logger.exception("failed to persist audit event")
                return
            except Exception:  # pragma: no cover
                db.rollback()
                audit_logger.exception("failed to persist audit event")
                return
            finally:
                db.close()
