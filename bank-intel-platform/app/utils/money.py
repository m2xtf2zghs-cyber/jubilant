from __future__ import annotations

import re


AMOUNT_RE = re.compile(r"\(?\s*-?\d[\d,]*(?:\.\d+)?\s*\)?")


def parse_amount(value: str | None) -> float:
    if value is None:
        return 0.0
    raw = str(value).strip()
    if raw in {"", "-", "--", "NA"}:
        return 0.0

    negative = False
    if raw.startswith("(") and raw.endswith(")"):
        negative = True
        raw = raw[1:-1].strip()

    raw = raw.replace("₹", "").replace(",", "").strip()
    raw = re.sub(r"(?i)\b(?:DR|CR)\b", "", raw).strip()
    if raw.startswith("-"):
        negative = True
        raw = raw[1:].strip()

    try:
        val = float(raw)
    except ValueError:
        m = AMOUNT_RE.search(raw)
        if not m:
            return 0.0
        val = float(m.group(0).replace(",", "").replace("(", "").replace(")", "").strip())
    return -val if negative else val


def to_lakhs(value: float) -> float:
    return round(value / 100000.0, 5)


def is_round_figure(value: float, base: int = 100000) -> bool:
    v = abs(int(round(value)))
    return v > 0 and v % base == 0
