#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def configure_paths() -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    api_path = repo_root / "apps" / "api"
    sys.path.insert(0, str(api_path))
    return api_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CreditAtlas API smoke test")
    parser.add_argument(
        "--db-url",
        default="sqlite:////tmp/creditatlas_smoke.db",
        help="SQLAlchemy database URL override (default: sqlite file in /tmp)",
    )
    parser.add_argument(
        "--preserve-db",
        action="store_true",
        help="Do not drop existing tables before test",
    )
    return parser.parse_args()


def prepare_database(preserve_db: bool) -> None:
    from app.db.base import Base
    from app.db.session import engine
    import app.models.entities  # noqa: F401

    if not preserve_db:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def run_smoke() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        login = client.post(
            "/auth/login",
            json={"email": "analyst@creditatlas.local", "password": "Password@123"},
        )
        assert login.status_code == 200, f"login failed: {login.text}"
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = client.get("/auth/me", headers=headers)
        assert me.status_code == 200, f"/auth/me failed: {me.text}"

        borrowers = client.get("/borrowers", headers=headers)
        assert borrowers.status_code == 200, f"/borrowers failed: {borrowers.text}"

        new_borrower = client.post(
            "/borrowers",
            headers=headers,
            json={
                "name": "Navrang Wholesale",
                "industry": "Distribution",
                "constitution": "Proprietorship",
            },
        )
        assert new_borrower.status_code == 200, f"create borrower failed: {new_borrower.text}"
        borrower_id = new_borrower.json()["id"]

        new_case = client.post("/cases", headers=headers, json={"borrower_id": borrower_id})
        assert new_case.status_code == 200, f"create case failed: {new_case.text}"
        case_id = new_case.json()["id"]

        files = {"file": ("bank_note.txt", b"case evidence sample", "text/plain")}
        upload = client.post(f"/cases/{case_id}/documents/upload", headers=headers, files=files)
        assert upload.status_code == 200, f"document upload failed: {upload.text}"

        payload = {
            "accounts": [
                {
                    "account_id": "SMK001",
                    "bank_name": "ICICI BANK",
                    "masked_account_number": "XXXX1234",
                    "transactions": [
                        {
                            "id": "x1",
                            "txn_date": "2026-01-05",
                            "amount": 350000,
                            "type": "CREDIT",
                            "description": "NEFT SALES FROM RETAIL ONE",
                        },
                        {
                            "id": "x2",
                            "txn_date": "2026-01-09",
                            "amount": -28000,
                            "type": "DEBIT",
                            "description": "ACH ICICI BUSINESS LOAN EMI",
                            "counterparty": "ICICI BUSINESS LOAN",
                        },
                        {
                            "id": "x3",
                            "txn_date": "2026-01-12",
                            "amount": 200000,
                            "type": "CREDIT",
                            "description": "UPI CREDIT MANGAL FINANCE",
                            "counterparty": "MANGAL FINANCE",
                        },
                        {
                            "id": "x4",
                            "txn_date": "2026-01-30",
                            "amount": -212000,
                            "type": "DEBIT",
                            "description": "RTGS TO MANGAL FINANCE",
                            "counterparty": "MANGAL FINANCE",
                        },
                        {
                            "id": "x5",
                            "txn_date": "2026-02-07",
                            "amount": -28000,
                            "type": "DEBIT",
                            "description": "ACH ICICI BUSINESS LOAN EMI",
                            "counterparty": "ICICI BUSINESS LOAN",
                        },
                    ],
                }
            ]
        }

        external_reference = f"smoke-ref-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        ingest = client.post(
            f"/cases/{case_id}/bank-ingestion/finbox",
            headers=headers,
            json={"external_reference": external_reference, "payload": payload},
        )
        assert ingest.status_code == 200, f"ingestion failed: {ingest.text}"

        checks = [
            f"/cases/{case_id}/bank-ingestion/status",
            f"/cases/{case_id}/transactions",
            f"/cases/{case_id}/transactions/monthly-summary",
            f"/cases/{case_id}/counterparties",
            f"/cases/{case_id}/emi-tracker",
            f"/cases/{case_id}/street-lender-intelligence",
            f"/cases/{case_id}/truth-engine",
            f"/cases/{case_id}/credit-brain",
            f"/cases/{case_id}/summary",
        ]

        for path in checks:
            resp = client.get(path, headers=headers)
            assert resp.status_code == 200, f"{path} failed: {resp.text}"

        credit = client.get(f"/cases/{case_id}/credit-brain", headers=headers).json()

        print("SMOKE_TEST_OK")
        print(f"case_id={case_id}")
        print(json.dumps(credit, indent=2))


def main() -> None:
    args = parse_args()
    configure_paths()
    os.environ["DATABASE_URL_OVERRIDE"] = args.db_url

    from app.seed import run_seed

    prepare_database(preserve_db=args.preserve_db)
    run_seed()
    run_smoke()


if __name__ == "__main__":
    main()
