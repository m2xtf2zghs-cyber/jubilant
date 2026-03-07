from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass
class CanonicalAccount:
    external_id: str
    bank_name: str | None
    account_number_masked: str | None
    ifsc: str | None
    holder_name: str | None


@dataclass
class CanonicalTransaction:
    external_txn_id: str
    txn_date: date
    value_date: date | None
    amount: float
    direction: str
    narration: str
    balance_after: float | None
    counterparty_name: str | None
    mode: str | None
    category_vendor: str | None
    vendor_confidence: float | None


@dataclass
class CanonicalIngestionBundle:
    accounts: list[CanonicalAccount]
    transactions_by_account: dict[str, list[CanonicalTransaction]]


class BankProvider(Protocol):
    def map_payload(self, payload: dict) -> CanonicalIngestionBundle: ...
