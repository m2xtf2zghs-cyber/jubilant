from __future__ import annotations

import re
from dataclasses import dataclass


def _norm(text: str) -> str:
    s = (text or "").upper()
    s = re.sub(r"[\u00A0\t]+", " ", s)
    s = re.sub(r"[^A-Z0-9\s/&.-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


@dataclass(frozen=True)
class BankProfile:
    code: str
    name_tokens: tuple[str, ...]
    strong_patterns: tuple[re.Pattern[str], ...]


PROFILES: tuple[BankProfile, ...] = (
    BankProfile(
        code="TMB",
        name_tokens=("TAMILNAD MERCANTILE BANK",),
        strong_patterns=(re.compile(r"\bTAMILNAD\s+MERCANTILE\s+BANK\b"),),
    ),
    BankProfile(
        code="BOI",
        name_tokens=("BANK OF INDIA",),
        strong_patterns=(
            re.compile(r"\bBANK\s+OF\s+INDIA\b"),
            re.compile(r"\bBKID0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="HDFC",
        name_tokens=("HDFC BANK", "HDFCBANK"),
        strong_patterns=(
            re.compile(r"\bHDFC\s+BANK\b"),
            re.compile(r"\bHDFC0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="SBI",
        name_tokens=("STATE BANK OF INDIA",),
        strong_patterns=(
            re.compile(r"\bSTATE\s+BANK\s+OF\s+INDIA\b"),
            re.compile(r"\bSBIN0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="ICICI",
        name_tokens=("ICICI BANK",),
        strong_patterns=(
            re.compile(r"\bICICI\s+BANK\b"),
            re.compile(r"\bICIC0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="AXIS",
        name_tokens=("AXIS BANK",),
        strong_patterns=(
            re.compile(r"\bAXIS\s+BANK\b"),
            re.compile(r"\bUTIB0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="CANARA",
        name_tokens=("CANARA BANK",),
        strong_patterns=(
            re.compile(r"\bCANARA\s+BANK\b"),
            re.compile(r"\bCNRB0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="IOB",
        name_tokens=("INDIAN OVERSEAS BANK",),
        strong_patterns=(
            re.compile(r"\bINDIAN\s+OVERSEAS\s+BANK\b"),
            re.compile(r"\bIOBA0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="KVB",
        name_tokens=("KARUR VYSYA BANK", "KARB", "KBL"),
        strong_patterns=(
            re.compile(r"\bKARUR\s+VYSYA\s+BANK\b"),
            re.compile(r"\bKARB0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="FEDERAL",
        name_tokens=("FEDERAL BANK",),
        strong_patterns=(
            re.compile(r"\bFEDERAL\s+BANK\b"),
            re.compile(r"\bFDRL0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="INDUSIND",
        name_tokens=("INDUSIND BANK",),
        strong_patterns=(
            re.compile(r"\bINDUSIND\s+BANK\b"),
            re.compile(r"\bINDB0\d{6}\b"),
        ),
    ),
    BankProfile(
        code="YES",
        name_tokens=("YES BANK",),
        strong_patterns=(
            re.compile(r"\bYES\s+BANK\b"),
            re.compile(r"\bYESB0\d{6}\b"),
        ),
    ),
)


def detect_bank(text: str) -> tuple[str, float]:
    """
    Header-oriented bank detection.
    Deliberately avoids IFSC/UTR-like transaction patterns to prevent false positives.
    """
    sample = _norm(text)
    if not sample:
        return "GENERIC", 0.0

    best_code = "GENERIC"
    best_score = 0.0
    for profile in PROFILES:
        score = 0.0
        for token in profile.name_tokens:
            if token in sample:
                score += 0.6
        for rx in profile.strong_patterns:
            if rx.search(sample):
                score += 0.8
        score = min(score, 1.0)
        if score > best_score:
            best_score = score
            best_code = profile.code

    if best_score < 0.45:
        return "GENERIC", 0.0
    return best_code, round(best_score, 4)
