from __future__ import annotations

from fastapi.testclient import TestClient


def test_auth_me_includes_role(client: TestClient, admin_headers: dict[str, str]) -> None:
    me = client.get("/auth/me", headers=admin_headers)
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "analyst@creditatlas.local"
    assert body["role"] == "ADMIN"


def test_reprocess_requires_manager_or_admin(client: TestClient, analyst_headers: dict[str, str]) -> None:
    # Role validation should fail before case lookup.
    resp = client.post("/cases/nonexistent/bank-ingestion/reprocess", headers=analyst_headers)
    assert resp.status_code == 403
    assert "Insufficient role" in resp.text
