from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.router import api_router
from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.db.init_db import init_db
from app.security import AuditLoggingMiddleware, BearerAuthMiddleware

settings = get_settings()
configure_logging(settings.log_level)

app = FastAPI(title=settings.app_name, version="0.1.0")
if settings.proxy_headers_enabled:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.proxy_trusted_ip_list or "*")
if settings.enforce_https_redirect:
    app.add_middleware(HTTPSRedirectMiddleware)
trusted_hosts = settings.trusted_host_list
if trusted_hosts and trusted_hosts != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)
app.add_middleware(BearerAuthMiddleware, settings=settings)
app.add_middleware(AuditLoggingMiddleware, settings=settings)
app.include_router(api_router, prefix="/api")
if settings.enable_console:
    app.mount("/console", StaticFiles(directory="app/static", html=True), name="console")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "docs": "/docs", "console": "/console" if settings.enable_console else "disabled"}
