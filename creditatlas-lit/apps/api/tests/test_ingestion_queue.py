from __future__ import annotations

from fastapi.testclient import TestClient

from app.services.queue import QueueUnavailableError


def test_ingestion_returns_503_when_queue_unavailable(
    client: TestClient,
    admin_headers: dict[str, str],
    monkeypatch,
) -> None:
    borrower = client.post(
        "/borrowers",
        headers=admin_headers,
        json={"name": "Queue Test Borrower", "industry": "Trading", "constitution": "Proprietorship"},
    )
    assert borrower.status_code == 200
    borrower_id = borrower.json()["id"]

    case = client.post("/cases", headers=admin_headers, json={"borrower_id": borrower_id})
    assert case.status_code == 200
    case_id = case.json()["id"]

    def _raise(*_args, **_kwargs):
        raise QueueUnavailableError("down")

    monkeypatch.setattr("app.api.routes.ingestion.enqueue_finbox_ingestion", _raise)

    payload = {
        "accounts": [
            {
                "account_id": "Q1",
                "transactions": [
                    {
                        "id": "qtx1",
                        "txn_date": "2026-01-01",
                        "amount": 1000,
                        "type": "CREDIT",
                        "description": "NEFT TEST",
                    }
                ],
            }
        ]
    }

    resp = client.post(
        f"/cases/{case_id}/bank-ingestion/finbox",
        headers=admin_headers,
        json={"external_reference": "queue-test-ref", "payload": payload},
    )
    assert resp.status_code == 503
