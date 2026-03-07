from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

# Configure app settings before importing app modules.
os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite:////tmp/creditatlas_pytest.db")
os.environ.setdefault("ENFORCE_MIGRATION_CHECK", "false")
os.environ.setdefault("ALLOW_INLINE_INGESTION_FALLBACK", "true")
os.environ.setdefault("STORAGE_BACKEND", "local")

from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.entities import User
from app.seed import run_seed


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    run_seed()
    return TestClient(app)


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/auth/login",
        json={"email": "analyst@creditatlas.app", "password": "Password@123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def analyst_headers(client: TestClient) -> dict[str, str]:
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == "analyst@creditatlas.app"))
        assert admin is not None
        analyst = db.scalar(select(User).where(User.email == "junior@creditatlas.app"))
        if not analyst:
            analyst = User(
                org_id=admin.org_id,
                email="junior@creditatlas.app",
                password_hash=get_password_hash("Password@123"),
                full_name="Junior Analyst",
                role="ANALYST",
            )
            db.add(analyst)
            db.commit()

    login = client.post(
        "/auth/login",
        json={"email": "junior@creditatlas.app", "password": "Password@123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
