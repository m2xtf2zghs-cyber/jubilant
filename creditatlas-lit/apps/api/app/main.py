from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, borrowers, cases, documents, exports, gst, ingestion, intelligence
from app.services.migrations import ensure_schema_up_to_date
from app.services.storage import storage

app = FastAPI(title="CreditAtlas LIT API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(borrowers.router)
app.include_router(cases.router)
app.include_router(documents.router)
app.include_router(ingestion.router)
app.include_router(intelligence.router)
app.include_router(gst.router)
app.include_router(exports.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema_up_to_date()
    try:
        storage.ensure_bucket()
    except Exception:
        # Bucket initialization can retry during first upload if MinIO is still starting.
        pass
