from __future__ import annotations

from fastapi.testclient import TestClient


def _create_case(client: TestClient, headers: dict[str, str]) -> str:
    borrower = client.post(
        "/borrowers",
        headers=headers,
        json={
            "name": "GST Borrower",
            "industry": "Trading",
            "constitution": "Proprietorship",
            "gstin": "27ABCDE1234F1Z5",
        },
    )
    assert borrower.status_code == 200
    borrower_id = borrower.json()["id"]

    case = client.post("/cases", headers=headers, json={"borrower_id": borrower_id})
    assert case.status_code == 200
    return case.json()["id"]


def test_gst_verify_and_profile(client: TestClient, admin_headers: dict[str, str]) -> None:
    case_id = _create_case(client, admin_headers)

    verify = client.post(
        f"/cases/{case_id}/gst/verify",
        headers=admin_headers,
        json={"gstin": "27ABCDE1234F1Z5"},
    )
    assert verify.status_code == 200
    body = verify.json()
    assert body["provider_name"] == "CLEAR"
    assert body["registration_status"] == "Active"

    profile = client.get(f"/cases/{case_id}/gst/profile", headers=admin_headers)
    assert profile.status_code == 200
    assert profile.json()["gstin"] == "27ABCDE1234F1Z5"


def test_gst_provider_fallback_to_karza(client: TestClient, admin_headers: dict[str, str]) -> None:
    case_id = _create_case(client, admin_headers)

    verify = client.post(
        f"/cases/{case_id}/gst/verify",
        headers=admin_headers,
        json={"gstin": "99ABCDE1234F1Z5"},
    )
    assert verify.status_code == 200
    assert verify.json()["provider_name"] == "KARZA"
