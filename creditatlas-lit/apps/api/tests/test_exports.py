from __future__ import annotations

from fastapi.testclient import TestClient


def _create_case_with_data(client: TestClient, headers: dict[str, str]) -> str:
    borrower = client.post(
        "/borrowers",
        headers=headers,
        json={"name": "Export Borrower", "industry": "Retail", "constitution": "Proprietorship"},
    )
    assert borrower.status_code == 200
    borrower_id = borrower.json()["id"]

    case = client.post("/cases", headers=headers, json={"borrower_id": borrower_id})
    assert case.status_code == 200
    case_id = case.json()["id"]

    payload = {
        "accounts": [
            {
                "account_id": "EXP001",
                "transactions": [
                    {
                        "id": "exp1",
                        "txn_date": "2026-01-03",
                        "amount": 120000,
                        "type": "CREDIT",
                        "description": "NEFT SALES",
                    },
                    {
                        "id": "exp2",
                        "txn_date": "2026-01-09",
                        "amount": -15000,
                        "type": "DEBIT",
                        "description": "ACH LOAN EMI",
                        "counterparty": "HDFC LOAN",
                    },
                ],
            }
        ]
    }
    ingest = client.post(
        f"/cases/{case_id}/bank-ingestion/finbox",
        headers=headers,
        json={"external_reference": f"exp-ref-{case_id}", "payload": payload},
    )
    assert ingest.status_code == 200
    return case_id


def test_export_json_shape(client: TestClient, admin_headers: dict[str, str]) -> None:
    case_id = _create_case_with_data(client, admin_headers)

    resp = client.get(f"/cases/{case_id}/export/json", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert "case" in body
    assert "borrower" in body
    assert "credit_brain" in body
    assert "truth_engine" in body
    assert "transactions" in body


def test_export_binary_formats(client: TestClient, admin_headers: dict[str, str]) -> None:
    case_id = _create_case_with_data(client, admin_headers)

    pdf = client.get(f"/cases/{case_id}/export/pdf", headers=admin_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF")

    xlsx = client.get(f"/cases/{case_id}/export/excel", headers=admin_headers)
    assert xlsx.status_code == 200
    assert xlsx.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert xlsx.content[:2] == b"PK"
