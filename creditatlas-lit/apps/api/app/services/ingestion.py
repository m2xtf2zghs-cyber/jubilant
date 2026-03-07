from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    AuditLog,
    BankAccount,
    BankStatement,
    BankTransactionNormalized,
    BankTransactionRaw,
    Counterparty,
    LoanCase,
    VendorPayload,
)
from app.providers.finbox import FinBoxBankProvider
from app.services.engines import run_all_engines
from app.services.normalization import (
    clean_narration,
    infer_internal_category,
    normalize_counterparty_name,
    resolve_counterparty,
)


def process_vendor_payload(db: Session, payload_id: str, triggered_by_user_id: str | None = None) -> dict:
    payload_row = db.get(VendorPayload, payload_id)
    if not payload_row:
        return {"status": "NOT_FOUND", "payload_id": payload_id}

    payload_row.status = "PROCESSING"
    payload_row.error_message = None
    db.flush()

    try:
        if payload_row.provider_name != "FINBOX":
            raise ValueError(f"Unsupported provider {payload_row.provider_name}")

        provider = FinBoxBankProvider()
        bundle = provider.map_payload(payload_row.payload)

        for account in bundle.accounts:
            account_row = _get_or_create_account(db, payload_row, account.external_id, account.bank_name, account.account_number_masked, account.ifsc, account.holder_name)
            _upsert_statement(db, payload_row, account_row.id)

            existing_external_txn_ids = {
                row[0]
                for row in db.execute(
                    select(BankTransactionRaw.external_txn_id).where(
                        BankTransactionRaw.case_id == payload_row.case_id,
                        BankTransactionRaw.account_id == account_row.id,
                    )
                ).all()
            }

            for txn in bundle.transactions_by_account.get(account.external_id, []):
                if txn.external_txn_id in existing_external_txn_ids:
                    continue

                raw_row = BankTransactionRaw(
                    org_id=payload_row.org_id,
                    case_id=payload_row.case_id,
                    account_id=account_row.id,
                    vendor_payload_id=payload_row.id,
                    external_txn_id=txn.external_txn_id,
                    txn_date=txn.txn_date,
                    value_date=txn.value_date,
                    amount=txn.amount,
                    direction=txn.direction,
                    narration=txn.narration,
                    balance_after=txn.balance_after,
                    counterparty_name=txn.counterparty_name,
                    mode=txn.mode,
                    category_vendor=txn.category_vendor,
                    vendor_confidence=txn.vendor_confidence,
                    source_vendor="FINBOX",
                )
                db.add(raw_row)
                db.flush()

                narration_clean = clean_narration(txn.narration)
                counterparty_alias = normalize_counterparty_name(txn.counterparty_name, narration_clean)
                cp_match = resolve_counterparty(
                    db,
                    org_id=payload_row.org_id,
                    case_id=payload_row.case_id,
                    alias_name=counterparty_alias,
                )
                category_internal = infer_internal_category(
                    narration_clean,
                    txn.direction,
                    cp_match.counterparty.canonical_name,
                )

                normalized_row = BankTransactionNormalized(
                    org_id=payload_row.org_id,
                    case_id=payload_row.case_id,
                    account_id=account_row.id,
                    raw_txn_id=raw_row.id,
                    txn_date=txn.txn_date,
                    value_date=txn.value_date,
                    amount=txn.amount,
                    direction=txn.direction,
                    narration_raw=txn.narration,
                    narration_clean=narration_clean,
                    counterparty_name=cp_match.counterparty.canonical_name,
                    counterparty_id=cp_match.counterparty.id,
                    mode=txn.mode,
                    category_vendor=txn.category_vendor,
                    category_internal=category_internal,
                    balance_after=txn.balance_after,
                    source_vendor="FINBOX",
                    vendor_confidence=txn.vendor_confidence,
                )
                db.add(normalized_row)
                _update_counterparty_rollup(cp_match.counterparty, normalized_row)

        payload_row.status = "PROCESSED"
        _refresh_case_analysis_coverage(db, payload_row.case_id)

        run_all_engines(db, payload_row.org_id, payload_row.case_id)

        db.add(
            AuditLog(
                org_id=payload_row.org_id,
                user_id=triggered_by_user_id,
                case_id=payload_row.case_id,
                action="BANK_INGESTION_PROCESSED",
                entity_type="vendor_payload",
                entity_id=payload_row.id,
                details={"provider": payload_row.provider_name, "status": payload_row.status},
            )
        )

        db.commit()
        return {"status": "PROCESSED", "payload_id": payload_row.id}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        payload_row = db.get(VendorPayload, payload_id)
        if payload_row:
            payload_row.status = "FAILED"
            payload_row.error_message = str(exc)
            db.commit()
        return {"status": "FAILED", "payload_id": payload_id, "error": str(exc)}


def _get_or_create_account(
    db: Session,
    payload_row: VendorPayload,
    external_id: str,
    bank_name: str | None,
    account_number_masked: str | None,
    ifsc: str | None,
    holder_name: str | None,
) -> BankAccount:
    existing = db.scalar(
        select(BankAccount)
        .where(BankAccount.case_id == payload_row.case_id)
        .where(BankAccount.source_vendor == payload_row.provider_name)
        .where(BankAccount.external_id == external_id)
    )
    if existing:
        if bank_name:
            existing.bank_name = bank_name
        if account_number_masked:
            existing.account_number_masked = account_number_masked
        if ifsc:
            existing.ifsc = ifsc
        if holder_name:
            existing.holder_name = holder_name
        return existing

    row = BankAccount(
        org_id=payload_row.org_id,
        case_id=payload_row.case_id,
        bank_name=bank_name,
        account_number_masked=account_number_masked,
        ifsc=ifsc,
        holder_name=holder_name,
        source_vendor=payload_row.provider_name,
        external_id=external_id,
    )
    db.add(row)
    db.flush()
    return row


def _upsert_statement(db: Session, payload_row: VendorPayload, account_id: str) -> None:
    row = db.scalar(
        select(BankStatement)
        .where(BankStatement.case_id == payload_row.case_id)
        .where(BankStatement.account_id == account_id)
        .where(BankStatement.source_vendor == payload_row.provider_name)
    )
    if not row:
        row = BankStatement(
            org_id=payload_row.org_id,
            case_id=payload_row.case_id,
            account_id=account_id,
            source_vendor=payload_row.provider_name,
        )
        db.add(row)

    row.status = "PROCESSED"
    row.last_ingested_at = datetime.now(timezone.utc)


def _update_counterparty_rollup(counterparty: Counterparty, txn: BankTransactionNormalized) -> None:
    counterparty.first_seen = min(filter(None, [counterparty.first_seen, txn.txn_date]), default=txn.txn_date)
    counterparty.last_seen = max(filter(None, [counterparty.last_seen, txn.txn_date]), default=txn.txn_date)
    counterparty.txn_count = (counterparty.txn_count or 0) + 1
    if txn.direction == "CREDIT":
        counterparty.total_credits = float(counterparty.total_credits or 0) + float(txn.amount)
    else:
        counterparty.total_debits = float(counterparty.total_debits or 0) + float(txn.amount)


def _refresh_case_analysis_coverage(db: Session, case_id: str) -> None:
    case = db.get(LoanCase, case_id)
    if not case:
        return

    rows = db.scalars(
        select(BankTransactionNormalized).where(BankTransactionNormalized.case_id == case_id)
    ).all()
    months = {row.txn_date.strftime("%Y-%m") for row in rows}
    accounts = {row.account_id for row in rows if row.account_id}

    case.months_analyzed = len(months)
    case.accounts_analyzed = len(accounts)
