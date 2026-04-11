from __future__ import annotations

import re


_REF_BLOCK = re.compile(r"\(REF#.*?\)", re.IGNORECASE)
_DATE_TOKEN = re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")
_LONG_ALNUM = re.compile(r"\b[A-Z]{3,}[A-Z0-9]{5,}\b")
_LONG_NUM = re.compile(r"\b\d{5,}\b")
_SMALL_NUM = re.compile(r"\b\d{1,4}\b")
_WHITESPACE = re.compile(r"\s+")


def normalize_type_label(value: str) -> str:
    t = _WHITESPACE.sub(" ", (value or "").upper()).strip()
    aliases = {
        "EXPENSES": "EXPENSE",
        "CASH WITHDRAWAL": "CASH",
        "CASH DEPOSIT": "CASH",
    }
    return aliases.get(t, t)


def narration_signature(raw_narration: str) -> str:
    s = (raw_narration or "").upper()
    s = _REF_BLOCK.sub(" ", s)
    s = _DATE_TOKEN.sub(" <DATE> ", s)
    s = _LONG_ALNUM.sub(" <REF> ", s)
    s = _LONG_NUM.sub(" <NUM> ", s)
    # keep separators meaningful, collapse noise
    s = re.sub(r"[^A-Z0-9 /:_\\-]", " ", s)
    s = _WHITESPACE.sub(" ", s).strip()
    return s[:240]


def signature_keys(raw_narration: str, debit: float, credit: float) -> list[str]:
    sig = narration_signature(raw_narration)
    sig_relaxed = _WHITESPACE.sub(" ", _SMALL_NUM.sub(" <SNUM> ", sig)).strip()
    direction = "C" if credit > 0 else "D" if debit > 0 else "Z"
    amount = credit if credit > 0 else debit
    return [
        f"{sig}|{direction}|{amount:.2f}",
        f"{sig_relaxed}|{direction}|{amount:.2f}",
        f"{sig}|{direction}",
        f"{sig_relaxed}|{direction}",
        sig,
        sig_relaxed,
    ]
