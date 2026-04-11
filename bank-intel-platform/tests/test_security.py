from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.settings import Settings
from app.security.middleware import BearerAuthMiddleware


def _auth_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        BearerAuthMiddleware,
        settings=Settings(auth_bearer_tokens="secret-token", auth_exempt_paths="/health"),
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/protected")
    def protected() -> dict[str, str]:
        return {"status": "ok"}

    return app


def test_bearer_auth_allows_exempt_route() -> None:
    client = TestClient(_auth_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["x-request-id"]


def test_bearer_auth_blocks_missing_token() -> None:
    client = TestClient(_auth_app())

    response = client.get("/protected")

    assert response.status_code == 401
    assert response.json()["detail"] == "unauthorized"
    assert response.json()["request_id"]


def test_bearer_auth_accepts_valid_token() -> None:
    client = TestClient(_auth_app())

    response = client.get("/protected", headers={"Authorization": "Bearer secret-token"})

    assert response.status_code == 200
    assert response.headers["x-request-id"]
