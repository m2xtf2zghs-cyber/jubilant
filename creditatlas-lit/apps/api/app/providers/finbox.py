from __future__ import annotations

import hashlib
from datetime import date, datetime

from app.providers.base import CanonicalAccount, CanonicalIngestionBundle, CanonicalTransaction

try:
    from dateutil.parser import parse as date_parse
except Exception:  # noqa: BLE001
    date_parse = None


class FinBoxBankProvider:
    """Maps FinBox payloads to internal canonical account and transaction objects."""

    def map_payload(self, payload: dict) -> CanonicalIngestionBundle:
        raw_accounts = payload.get("accounts") or payload.get("bank_accounts") or []
        accounts: list[CanonicalAccount] = []
        transactions_by_account: dict[str, list[CanonicalTransaction]] = {}

        for idx, acc in enumerate(raw_accounts):
            external_id = str(acc.get("account_id") or acc.get("id") or f"acc_{idx}")
            account = CanonicalAccount(
                external_id=external_id,
                bank_name=acc.get("bank_name") or acc.get("bank"),
                account_number_masked=acc.get("masked_account_number")
                or acc.get("account_number_masked")
                or acc.get("account_number"),
                ifsc=acc.get("ifsc"),
                holder_name=acc.get("holder_name") or acc.get("name"),
            )
            accounts.append(account)

            txns = acc.get("transactions") or []
            mapped: list[CanonicalTransaction] = []
            for t_idx, txn in enumerate(txns):
                mapped.append(self._map_transaction(external_id, txn, t_idx))
            transactions_by_account[external_id] = mapped

        return CanonicalIngestionBundle(accounts=accounts, transactions_by_account=transactions_by_account)

    def _map_transaction(
        self,
        account_external_id: str,
        txn: dict,
        fallback_idx: int,
    ) -> CanonicalTransaction:
        amount_raw = float(txn.get("amount") or 0.0)
        txn_type = str(txn.get("type") or txn.get("direction") or "").upper()
        is_credit = txn_type in {"CREDIT", "CR", "IN"} or amount_raw > 0
        amount = abs(amount_raw)
        direction = "CREDIT" if is_credit else "DEBIT"

        txn_date = self._parse_date(txn.get("txn_date") or txn.get("date") or txn.get("transaction_date"))
        value_date = self._parse_date(txn.get("value_date"))
        narration = str(txn.get("description") or txn.get("narration") or txn.get("remark") or "")

        external_txn_id = str(txn.get("id") or txn.get("txn_id") or "")
        if not external_txn_id:
            digest = hashlib.sha256(
                f"{account_external_id}|{txn_date}|{amount}|{direction}|{narration}|{fallback_idx}".encode()
            ).hexdigest()[:24]
            external_txn_id = f"fx_{digest}"

        counterparty = txn.get("counterparty") or txn.get("beneficiary") or txn.get("merchant")
        mode = txn.get("mode") or txn.get("channel") or txn.get("payment_mode")
        category_vendor = txn.get("category") or txn.get("category_vendor")
        vendor_confidence = txn.get("confidence")

        return CanonicalTransaction(
            external_txn_id=external_txn_id,
            txn_date=txn_date,
            value_date=value_date,
            amount=amount,
            direction=direction,
            narration=narration,
            balance_after=txn.get("balance") or txn.get("balance_after"),
            counterparty_name=counterparty,
            mode=mode,
            category_vendor=category_vendor,
            vendor_confidence=float(vendor_confidence) if vendor_confidence is not None else None,
        )

    @staticmethod
    def _parse_date(raw: str | None) -> date:
        if not raw:
            return date.today()
        value = str(raw)
        if date_parse is not None:
            return date_parse(value).date()
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
