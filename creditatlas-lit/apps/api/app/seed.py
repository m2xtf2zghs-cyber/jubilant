from __future__ import annotations

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.entities import Borrower, LoanCase, Organization, User, VendorPayload
from app.services.ingestion import process_vendor_payload


def run_seed() -> None:
    with SessionLocal() as db:
        org = db.scalar(select(Organization).where(Organization.name == "CreditAtlas Demo Org"))
        if not org:
            org = Organization(name="CreditAtlas Demo Org")
            db.add(org)
            db.flush()

        user = db.scalar(select(User).where(User.email == "analyst@creditatlas.app"))
        if not user:
            user = User(
                org_id=org.id,
                email="analyst@creditatlas.app",
                password_hash=get_password_hash("Password@123"),
                full_name="Lead Analyst",
                role="ADMIN",
            )
            db.add(user)
            db.flush()
        elif user.role != "ADMIN":
            user.role = "ADMIN"

        borrower = db.scalar(select(Borrower).where(Borrower.name == "Shree Balaji Traders"))
        if not borrower:
            borrower = Borrower(
                org_id=org.id,
                name="Shree Balaji Traders",
                industry="FMCG Distribution",
                constitution="Proprietorship",
                gstin="27ABCDE1234F1Z5",
                pan="ABCDE1234F",
            )
            db.add(borrower)
            db.flush()

        case = db.scalar(select(LoanCase).where(LoanCase.borrower_id == borrower.id))
        if not case:
            case = LoanCase(
                org_id=org.id,
                borrower_id=borrower.id,
                analyst_user_id=user.id,
                status="OPEN",
            )
            db.add(case)
            db.flush()

        payload = db.scalar(
            select(VendorPayload)
            .where(VendorPayload.case_id == case.id)
            .where(VendorPayload.external_reference == "finbox-demo-2026-01")
        )
        if not payload:
            payload = VendorPayload(
                org_id=org.id,
                case_id=case.id,
                provider_name="FINBOX",
                payload_type="BANK_STATEMENT",
                external_reference="finbox-demo-2026-01",
                status="QUEUED",
                payload=sample_finbox_payload(),
            )
            db.add(payload)
            db.commit()
            process_vendor_payload(db, payload.id, user.id)
        else:
            db.commit()

        print("Seed completed")
        print(f"org_id={org.id}")
        print(f"user_email={user.email}")
        print(f"case_id={case.id}")


def sample_finbox_payload() -> dict:
    return {
        "accounts": [
            {
                "account_id": "ACC_MAIN_001",
                "bank_name": "HDFC BANK",
                "masked_account_number": "XXXXXX1234",
                "ifsc": "HDFC0001234",
                "holder_name": "SHREE BALAJI TRADERS",
                "transactions": [
                    {"id": "t001", "txn_date": "2025-10-05", "amount": 460000, "type": "CREDIT", "description": "NEFT FROM RELIANCE RETAIL INV 451"},
                    {"id": "t002", "txn_date": "2025-10-07", "amount": -45000, "type": "DEBIT", "description": "ACH HDFC SME LOAN EMI", "counterparty": "HDFC BANK LOAN"},
                    {"id": "t003", "txn_date": "2025-10-12", "amount": 300000, "type": "CREDIT", "description": "UPI CR FINANCE HOUSE", "counterparty": "MANGAL FINANCE"},
                    {"id": "t004", "txn_date": "2025-10-29", "amount": -315000, "type": "DEBIT", "description": "RTGS TO MANGAL FINANCE"},
                    {"id": "t005", "txn_date": "2025-11-04", "amount": 510000, "type": "CREDIT", "description": "IMPS DMART SUPPLY PAYOUT"},
                    {"id": "t006", "txn_date": "2025-11-08", "amount": -45000, "type": "DEBIT", "description": "ACH HDFC SME LOAN EMI", "counterparty": "HDFC BANK LOAN"},
                    {"id": "t007", "txn_date": "2025-11-10", "amount": 400000, "type": "CREDIT", "description": "NEFT FROM JIO MART"},
                    {"id": "t008", "txn_date": "2025-11-17", "amount": 250000, "type": "CREDIT", "description": "UPI CREDIT SHIVSHAKTI CAPITAL", "counterparty": "SHIVSHAKTI CAPITAL"},
                    {"id": "t009", "txn_date": "2025-12-03", "amount": 495000, "type": "CREDIT", "description": "NEFT FROM MORE RETAIL"},
                    {"id": "t010", "txn_date": "2025-12-10", "amount": -45000, "type": "DEBIT", "description": "ACH HDFC SME LOAN EMI", "counterparty": "HDFC BANK LOAN"},
                    {"id": "t011", "txn_date": "2025-12-12", "amount": -262500, "type": "DEBIT", "description": "IMPS TO SHIVSHAKTI CAPITAL", "counterparty": "SHIVSHAKTI CAPITAL"},
                    {"id": "t012", "txn_date": "2025-12-15", "amount": 520000, "type": "CREDIT", "description": "RTGS SALES RECEIPT BIG BAZAAR"},
                    {"id": "t013", "txn_date": "2026-01-06", "amount": 550000, "type": "CREDIT", "description": "NEFT FROM DMART"},
                    {"id": "t014", "txn_date": "2026-01-09", "amount": -45000, "type": "DEBIT", "description": "ACH HDFC SME LOAN EMI", "counterparty": "HDFC BANK LOAN"},
                    {"id": "t015", "txn_date": "2026-01-13", "amount": 300000, "type": "CREDIT", "description": "UPI CREDIT MANGAL FINANCE", "counterparty": "MANGAL FINANCE"},
                    {"id": "t016", "txn_date": "2026-01-31", "amount": -324000, "type": "DEBIT", "description": "RTGS TO MANGAL FINANCE"},
                    {"id": "t017", "txn_date": "2026-01-16", "amount": 25000, "type": "CREDIT", "description": "REFUND UPI REVERSAL"},
                    {"id": "t018", "txn_date": "2026-01-25", "amount": 100000, "type": "CREDIT", "description": "SELF TRANSFER FROM OWN A/C"},
                ],
            }
        ]
    }


if __name__ == "__main__":
    run_seed()
