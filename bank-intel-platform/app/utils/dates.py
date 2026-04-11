from __future__ import annotations

from datetime import date, datetime

FORMATS = (
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%Y-%m-%d",
    "%d/%m/%y",
    "%d-%m-%y",
)


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    for fmt in FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def month_key(dt: date | None) -> str:
    if dt is None:
        return "UNKNOWN"
    if dt.month in (1, 2, 3):
        return f"{dt.strftime('%b').upper()}({dt.year % 100:02d})"
    return dt.strftime("%b").upper()
