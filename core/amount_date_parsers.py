from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable, Optional


DATE_FORMATS_DEFAULT: tuple[str, ...] = (
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%Y-%m-%d",
    "%d/%m/%y",
    "%d-%m-%y",
)

_MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}

AMOUNT_TOKEN_RE = re.compile(r"\(?\s*-?\d[\d,]*(?:\.\d+)?\s*\)?(?:\s*(?:DR|CR))?", re.IGNORECASE)


def parse_date(s: str, formats: Iterable[str] = DATE_FORMATS_DEFAULT) -> date:
    raw = (s or "").strip()
    if not raw:
        raise ValueError("Empty date string")

    raw2 = raw.replace(".", "/").replace("\\", "/").strip()

    for fmt in formats:
        try:
            return datetime.strptime(raw2, fmt).date()
        except ValueError:
            continue

    m = re.match(r"^\s*(\d{1,2})[\s\-\/]([A-Za-z]{3,})[\s\-\/](\d{2,4})\s*$", raw2)
    if m:
        dd = int(m.group(1))
        mon = m.group(2)[:3].upper()
        yy = int(m.group(3))
        if yy < 100:
            yy += 2000
        if mon not in _MONTHS:
            raise ValueError(f"Unknown month token in date: {raw}")
        return date(yy, _MONTHS[mon], dd)

    raise ValueError(f"Unparseable date: {raw}")


def parse_amount(s: Optional[str]) -> float:
    if s is None:
        return 0.0
    raw = str(s).strip()
    if raw == "" or raw in {"-", "—"}:
        return 0.0

    neg = False
    if raw.startswith("(") and raw.endswith(")"):
        neg = True
        raw = raw[1:-1].strip()

    raw = raw.replace("₹", "").replace(",", "").strip()
    raw = re.sub(r"(?i)\b(?:DR|CR)\b", "", raw).strip()

    if raw.startswith("-"):
        neg = True
        raw = raw[1:].strip()

    if not re.match(r"^\d+(?:\.\d+)?$", raw):
        m = re.search(r"(\d+(?:\.\d+)?)", raw)
        if not m:
            return 0.0
        raw = m.group(1)

    val = float(raw)
    return -val if neg else val


def infer_dr_cr(
    debit_str: Optional[str],
    credit_str: Optional[str],
    amount_str: Optional[str] = None,
    drcr_indicator: Optional[str] = None,
) -> tuple[float, float]:
    dr = parse_amount(debit_str)
    cr = parse_amount(credit_str)

    if dr > 0 and cr > 0:
        return dr, 0.0
    if dr > 0 or cr > 0:
        return dr, cr

    amt = parse_amount(amount_str)
    if amt == 0.0:
        return 0.0, 0.0

    ind = (drcr_indicator or "").strip().upper()
    if ind in {"DR", "D", "DEBIT", "WITHDRAWAL"}:
        return abs(amt), 0.0
    if ind in {"CR", "C", "CREDIT", "DEPOSIT"}:
        return 0.0, abs(amt)

    if amt < 0:
        return abs(amt), 0.0
    return 0.0, abs(amt)


def amount_to_lakhs(amount_rupees: float, divisor: float = 100000.0) -> float:
    return amount_rupees / divisor


def detect_round_figure(amount_rupees: float, bases: tuple[int, ...] = (100000,)) -> bool:
    amt = abs(int(round(amount_rupees)))
    if amt == 0:
        return False
    return any(amt % b == 0 for b in bases)


def extract_amount_tokens(text: str) -> list[str]:
    return [m.group(0).strip() for m in AMOUNT_TOKEN_RE.finditer(text)]
