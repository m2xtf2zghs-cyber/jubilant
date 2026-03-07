from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Counterparty, CounterpartyAlias

NOISE_TOKENS = {
    "UPI",
    "IMPS",
    "NEFT",
    "RTGS",
    "MB",
    "MOBILE",
    "BANK",
    "A/C",
    "AC",
    "TXN",
    "TRANSFER",
    "PAYMENT",
    "TRF",
    "P2A",
    "A2A",
    "ACH",
    "NACH",
    "VPA",
}

LENDER_KEYWORDS = {
    "HDFC",
    "ICICI",
    "AXIS",
    "BAJAJ",
    "TATA",
    "FINANCE",
    "CAPITAL",
    "LOAN",
    "MUTHOOT",
    "CHOLA",
    "SHRIRAM",
    "KOTAK",
    "IDFC",
}

try:
    from rapidfuzz import fuzz

    def similarity(a: str, b: str) -> float:
        return float(fuzz.ratio(a, b))
except Exception:  # noqa: BLE001
    def similarity(a: str, b: str) -> float:
        return SequenceMatcher(None, a, b).ratio() * 100.0


@dataclass
class CounterpartyMatch:
    counterparty: Counterparty
    method: str


def clean_narration(text: str) -> str:
    cleaned = text.upper().strip()
    cleaned = re.sub(r"[^A-Z0-9\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def normalize_counterparty_name(raw: str | None, narration: str) -> str:
    base = raw or narration
    text = clean_narration(base)

    parts = [token for token in text.split(" ") if token and token not in NOISE_TOKENS]
    if not parts:
        return "UNKNOWN_COUNTERPARTY"

    normalized = " ".join(parts)
    normalized = re.sub(r"\b(PVT|LTD|LIMITED|PRIVATE)\b", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized or "UNKNOWN_COUNTERPARTY"


def infer_internal_category(narration_clean: str, direction: str, canonical_counterparty: str) -> str:
    if "SALARY" in narration_clean:
        return "PAYROLL"
    if any(token in narration_clean for token in ["GST", "TAX", "TDS"]):
        return "STATUTORY"
    if any(token in narration_clean for token in ["RENT", "LEASE"]):
        return "RENT"
    if any(token in narration_clean for token in ["SELF", "OWN", "A2A", "TRANSFER TO"]):
        return "INTERNAL_TRANSFER"
    if direction == "CREDIT" and any(token in narration_clean for token in ["REFUND", "REVERSAL"]):
        return "REFUND"
    if direction == "DEBIT" and any(token in canonical_counterparty for token in LENDER_KEYWORDS):
        return "FORMAL_LENDER_PAYMENT"
    if direction == "CREDIT":
        return "BUSINESS_CREDIT"
    return "BUSINESS_DEBIT"


def resolve_counterparty(
    db: Session,
    *,
    org_id: str,
    case_id: str,
    alias_name: str,
) -> CounterpartyMatch:
    alias_q = db.scalar(
        select(CounterpartyAlias)
        .where(CounterpartyAlias.case_id == case_id)
        .where(CounterpartyAlias.alias_name == alias_name)
    )
    if alias_q:
        cp = db.get(Counterparty, alias_q.counterparty_id)
        if cp:
            return CounterpartyMatch(counterparty=cp, method="ALIAS_EXACT")

    all_counterparties = db.scalars(
        select(Counterparty).where(Counterparty.case_id == case_id)
    ).all()
    for cp in all_counterparties:
        score = similarity(cp.canonical_name, alias_name)
        if score >= 92:
            alias = CounterpartyAlias(
                org_id=org_id,
                case_id=case_id,
                counterparty_id=cp.id,
                alias_name=alias_name,
                match_method="FUZZY",
            )
            db.add(alias)
            return CounterpartyMatch(counterparty=cp, method="FUZZY")

    cp = Counterparty(
        org_id=org_id,
        case_id=case_id,
        canonical_name=alias_name,
        kind="LENDER" if any(k in alias_name for k in LENDER_KEYWORDS) else "UNKNOWN",
    )
    db.add(cp)
    db.flush()

    alias = CounterpartyAlias(
        org_id=org_id,
        case_id=case_id,
        counterparty_id=cp.id,
        alias_name=alias_name,
        match_method="DETERMINISTIC",
    )
    db.add(alias)
    return CounterpartyMatch(counterparty=cp, method="NEW")
