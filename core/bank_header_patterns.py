"""
bank_header_patterns.py

Starter library for:
1) Detecting bank + statement table headers across common Indian banks
2) Mapping header labels to canonical columns:
   date, value_date, narration, ref_no, debit, credit, balance

Design goals:
- Be tolerant to OCR noise and spacing/punctuation differences
- Avoid hard-coding exact layouts; use token scoring + regex

Usage:
- Call `detect_bank(text)` on first 1–2 pages text (or concatenated header area)
- Call `detect_table_header(lines)` on page lines to locate header row
- Call `map_header_to_columns(header_cells)` to get canonical column indices
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# -----------------------------
# Canonical columns
# -----------------------------
CANON_COLS = ("date", "value_date", "narration", "ref_no", "debit", "credit", "balance")


def _norm(s: str) -> str:
    """Aggressive normalization for header detection."""
    s = s.upper()
    s = re.sub(r"[\u00A0\t]+", " ", s)  # NBSP/tabs -> space
    s = re.sub(r"[^\w\s/.-]", " ", s)  # strip most punctuation, keep some separators
    s = re.sub(r"\s+", " ", s).strip()
    return s


@dataclass(frozen=True)
class BankProfile:
    code: str
    name: str
    detect_tokens: list[str]  # if any/all found -> bank score up
    detect_regexes: list[re.Pattern[str]]  # regex-based extra signals
    header_regexes: list[re.Pattern[str]]  # patterns that identify transaction table header row(s)
    column_aliases: dict[str, list[re.Pattern[str]]]  # canonical_col -> label regex list


def _rx(words: list[str]) -> re.Pattern[str]:
    """Build a forgiving regex that matches tokens in order with noise allowed."""
    parts = [re.escape(w) for w in words]
    return re.compile(r"\b" + r"\W*".join(parts) + r"\b", re.IGNORECASE)


# -----------------------------
# Shared column label patterns
# -----------------------------
COMMON_COLUMN_ALIASES: dict[str, list[re.Pattern[str]]] = {
    "date": [
        _rx(["DATE"]),
        _rx(["TXN", "DATE"]),
        _rx(["TRANSACTION", "DATE"]),
        _rx(["TRAN", "DATE"]),
        _rx(["POSTING", "DATE"]),
    ],
    "value_date": [
        _rx(["VALUE", "DATE"]),
        _rx(["VAL", "DATE"]),
    ],
    "narration": [
        _rx(["NARRATION"]),
        _rx(["DESCRIPTION"]),
        _rx(["PARTICULARS"]),
        _rx(["REMARKS"]),
        _rx(["DETAILS"]),
        _rx(["TRANSACTION", "REMARKS"]),
        _rx(["TRANSACTION", "DETAILS"]),
    ],
    "ref_no": [
        _rx(["CHQ", "NO"]),
        _rx(["CHEQUE", "NO"]),
        _rx(["CHEQUE", "NUMBER"]),
        _rx(["REF", "NO"]),
        _rx(["REFERENCE", "NO"]),
        _rx(["UTR", "NO"]),
        _rx(["TRANSACTION", "ID"]),
        _rx(["TXN", "ID"]),
    ],
    "debit": [
        _rx(["DEBIT"]),
        _rx(["DR"]),
        _rx(["WITHDRAWAL"]),
        _rx(["WITHDRAWALS"]),
        _rx(["WITHDRAWN"]),
        _rx(["AMOUNT", "DR"]),
        _rx(["DEBIT", "AMOUNT"]),
    ],
    "credit": [
        _rx(["CREDIT"]),
        _rx(["CR"]),
        _rx(["DEPOSIT"]),
        _rx(["DEPOSITS"]),
        _rx(["AMOUNT", "CR"]),
        _rx(["CREDIT", "AMOUNT"]),
    ],
    "balance": [
        _rx(["BALANCE"]),
        _rx(["CLOSING", "BALANCE"]),
        _rx(["RUNNING", "BALANCE"]),
        _rx(["ACCOUNT", "BALANCE"]),
        _rx(["AVAILABLE", "BALANCE"]),
    ],
}


def _merge_aliases(
    base: dict[str, list[re.Pattern[str]]],
    extra: dict[str, list[re.Pattern[str]]] | None = None,
) -> dict[str, list[re.Pattern[str]]]:
    if not extra:
        return dict(base)
    out = {k: list(v) for k, v in base.items()}
    for k, v in extra.items():
        out.setdefault(k, [])
        out[k].extend(v)
    return out


# -----------------------------
# Bank profiles
# -----------------------------
BANK_PROFILES: list[BankProfile] = [
    BankProfile(
        code="TMB",
        name="Tamilnad Mercantile Bank",
        detect_tokens=["TAMILNAD MERCANTILE BANK", "TMB"],
        detect_regexes=[
            re.compile(r"\bTMBLH\d{8}\d+\b", re.IGNORECASE),
            re.compile(r"\bTMBLR\d{8}\d+\b", re.IGNORECASE),
        ],
        header_regexes=[
            re.compile(r"TXN\.?\s*DATE.*TRANSACTION.*REMARKS.*DEBIT.*CREDIT.*BAL", re.IGNORECASE),
            re.compile(r"TXN\s*DATE.*REMARKS.*DEBIT.*CREDIT.*ACCOUNT\s*BAL", re.IGNORECASE),
        ],
        column_aliases=_merge_aliases(
            COMMON_COLUMN_ALIASES,
            {
                "narration": [_rx(["TRANSACTION", "REMARKS"])],
                "balance": [_rx(["ACCOUNT", "BALANCE"])],
            },
        ),
    ),
    BankProfile(
        code="SBI",
        name="State Bank of India",
        detect_tokens=["STATE BANK OF INDIA", "SBI", "SBIN"],
        detect_regexes=[re.compile(r"\bSBIN\d{6,}\b", re.IGNORECASE)],
        header_regexes=[
            re.compile(
                r"TXN\s*DATE.*VALUE\s*DATE.*DESCRIPTION.*(REF|CHEQUE).*(DEBIT|WITHDRAWAL).*(CREDIT|DEPOSIT).*(BALANCE)",
                re.IGNORECASE,
            ),
            re.compile(
                r"TRANSACTION\s*DATE.*DESCRIPTION.*(REF|CHEQUE).*(DEBIT).*(CREDIT).*(BALANCE)",
                re.IGNORECASE,
            ),
        ],
        column_aliases=_merge_aliases(
            COMMON_COLUMN_ALIASES,
            {
                "narration": [_rx(["DESCRIPTION"])],
                "ref_no": [_rx(["REF", "NO"]), _rx(["CHEQUE", "NO"])],
            },
        ),
    ),
    BankProfile(
        code="HDFC",
        name="HDFC Bank",
        detect_tokens=["HDFC BANK", "HDFC"],
        detect_regexes=[
            re.compile(r"\bHDFCR\d{8}\d+\b", re.IGNORECASE),
            re.compile(r"\bHDFC[HN]\w+\b", re.IGNORECASE),
        ],
        header_regexes=[
            re.compile(
                r"\bDATE\b.*\bNARRATION\b.*(CHQ|REF).*VALUE.*(WITHDRAWAL|DEBIT).*(DEPOSIT|CREDIT).*(CLOSING\s*BALANCE|BALANCE)",
                re.IGNORECASE,
            ),
            re.compile(
                r"\bDATE\b.*\bDESCRIPTION\b.*(CHQ|REF).*VALUE.*(WITHDRAWAL|DEBIT).*(DEPOSIT|CREDIT).*(BALANCE)",
                re.IGNORECASE,
            ),
        ],
        column_aliases=_merge_aliases(
            COMMON_COLUMN_ALIASES,
            {
                "narration": [_rx(["NARRATION"])],
                "balance": [_rx(["CLOSING", "BALANCE"])],
            },
        ),
    ),
    BankProfile(
        code="ICICI",
        name="ICICI Bank",
        detect_tokens=["ICICI BANK", "ICICI"],
        detect_regexes=[re.compile(r"\bICIC[RN]\w+\b", re.IGNORECASE)],
        header_regexes=[
            re.compile(
                r"S\.?\s*NO.*TRANSACTION\s*DATE.*VALUE\s*DATE.*DESCRIPTION.*(CHEQUE|CHQ).*(DEBIT|DR).*(CREDIT|CR).*(BALANCE)",
                re.IGNORECASE,
            ),
            re.compile(
                r"TRANSACTION\s*DATE.*DESCRIPTION.*(CHEQUE|CHQ|REF).*(DEBIT|WITHDRAWAL).*(CREDIT|DEPOSIT).*(BALANCE)",
                re.IGNORECASE,
            ),
        ],
        column_aliases=_merge_aliases(
            COMMON_COLUMN_ALIASES,
            {
                "date": [_rx(["TRANSACTION", "DATE"])],
                "narration": [_rx(["DESCRIPTION"])],
            },
        ),
    ),
    BankProfile(
        code="AXIS",
        name="Axis Bank",
        detect_tokens=["AXIS BANK", "UTIB"],
        detect_regexes=[re.compile(r"\bUTIB\d{6,}\b", re.IGNORECASE)],
        header_regexes=[
            re.compile(
                r"(TRAN\s*DATE|TRANSACTION\s*DATE|DATE).*(CHQ|CHEQUE).*PARTICULARS.*(DEBIT|WITHDRAWAL).*(CREDIT|DEPOSIT).*(BALANCE)",
                re.IGNORECASE,
            ),
            re.compile(r"DATE.*PARTICULARS.*(DEBIT|DR).*(CREDIT|CR).*(BALANCE)", re.IGNORECASE),
        ],
        column_aliases=_merge_aliases(COMMON_COLUMN_ALIASES, {"narration": [_rx(["PARTICULARS"])]}),
    ),
    BankProfile(
        code="INDUSIND",
        name="IndusInd Bank",
        detect_tokens=["INDUSIND BANK", "INDUSIND"],
        detect_regexes=[],
        header_regexes=[
            re.compile(r"DATE.*NARRATION.*(CHQ|REF).*DEBIT.*CREDIT.*BALANCE", re.IGNORECASE),
            re.compile(
                r"TRANSACTION\s*DATE.*DESCRIPTION.*(DEBIT|WITHDRAWAL).*(CREDIT|DEPOSIT).*(BALANCE)",
                re.IGNORECASE,
            ),
        ],
        column_aliases=_merge_aliases(
            COMMON_COLUMN_ALIASES,
            {"narration": [_rx(["NARRATION"]), _rx(["DESCRIPTION"])]},
        ),
    ),
    BankProfile(
        code="YES",
        name="Yes Bank",
        detect_tokens=["YES BANK"],
        detect_regexes=[],
        header_regexes=[re.compile(r"DATE.*DESCRIPTION.*(CHQ|REF).*DEBIT.*CREDIT.*BALANCE", re.IGNORECASE)],
        column_aliases=_merge_aliases(COMMON_COLUMN_ALIASES, {}),
    ),
    BankProfile(
        code="FEDERAL",
        name="Federal Bank",
        detect_tokens=["FEDERAL BANK"],
        detect_regexes=[],
        header_regexes=[
            re.compile(
                r"DATE.*DESCRIPTION.*(REF|CHEQUE).*(DEBIT|WITHDRAWAL).*(CREDIT|DEPOSIT).*(BALANCE)",
                re.IGNORECASE,
            )
        ],
        column_aliases=_merge_aliases(COMMON_COLUMN_ALIASES, {}),
    ),
    BankProfile(
        code="GENERIC",
        name="Generic/Unknown Bank",
        detect_tokens=[],
        detect_regexes=[],
        header_regexes=[
            re.compile(
                r"(TXN\s*DATE|TRANSACTION\s*DATE|DATE).*(NARRATION|DESCRIPTION|PARTICULARS|REMARKS).*(DEBIT|WITHDRAWAL|DR).*(CREDIT|DEPOSIT|CR).*(BALANCE)",
                re.IGNORECASE,
            )
        ],
        column_aliases=_merge_aliases(COMMON_COLUMN_ALIASES, {}),
    ),
]


# -----------------------------
# Bank detection
# -----------------------------
def detect_bank(text: str) -> tuple[str, float]:
    """
    Detect bank code from extracted text using token + regex scoring.
    Returns (bank_code, score).
    """
    t = _norm(text)
    best_code = "GENERIC"
    best_score = 0.0

    for profile in BANK_PROFILES:
        if profile.code == "GENERIC":
            continue

        score = 0.0
        for tok in profile.detect_tokens:
            if tok.upper() in t:
                score += 1.0

        for rx in profile.detect_regexes:
            if rx.search(t):
                score += 1.25

        max_possible = max(
            1.0,
            len(profile.detect_tokens) + 1.25 * max(1, len(profile.detect_regexes)),
        )
        score = score / max_possible

        if score > best_score:
            best_score = score
            best_code = profile.code

    if best_score < 0.15:
        return "GENERIC", 0.0
    return best_code, float(round(best_score, 4))


# -----------------------------
# Header row detection
# -----------------------------
def detect_table_header(lines: list[str], bank_code: str) -> int | None:
    """
    Given a list of text lines for a page (already OCR/text-extracted),
    return the line index that most likely contains the transaction table header.
    """
    profile = next((p for p in BANK_PROFILES if p.code == bank_code), None)
    if profile is None:
        profile = next(p for p in BANK_PROFILES if p.code == "GENERIC")

    generic = next(p for p in BANK_PROFILES if p.code == "GENERIC")
    candidates = profile.header_regexes + generic.header_regexes

    for i, line in enumerate(lines):
        s = _norm(line)
        for rx in candidates:
            if rx.search(s):
                return i
    return None


# -----------------------------
# Column mapping from header tokens/cells
# -----------------------------
def map_header_to_columns(header_cells: list[str], bank_code: str) -> dict[str, int | None]:
    """
    Given header cells (already split by table extractor) map to canonical columns.
    Returns dict canonical_col -> index (or None if not found).
    """
    profile = next((p for p in BANK_PROFILES if p.code == bank_code), None)
    if profile is None:
        profile = next(p for p in BANK_PROFILES if p.code == "GENERIC")

    mapped: dict[str, int | None] = {c: None for c in CANON_COLS}
    cells_norm = [_norm(c) for c in header_cells]

    for canon_col, patterns in profile.column_aliases.items():
        best_idx = None
        for idx, cell in enumerate(cells_norm):
            if any(rx.search(cell) for rx in patterns):
                best_idx = idx
                break
        mapped[canon_col] = best_idx

    return mapped


# -----------------------------
# Utility: quick header scoring
# -----------------------------
def score_header_line(line: str) -> float:
    """
    Scores a single line for being a plausible transaction header, bank-agnostic.
    Useful for generic adapters that don't split cells.
    """
    s = _norm(line)
    tokens = {
        "DATE": bool(re.search(r"\bDATE\b|TXN\s*DATE|TRANSACTION\s*DATE", s)),
        "NARR": bool(re.search(r"NARRATION|DESCRIPTION|PARTICULARS|REMARKS", s)),
        "DR": bool(re.search(r"DEBIT|WITHDRAWAL|\bDR\b", s)),
        "CR": bool(re.search(r"CREDIT|DEPOSIT|\bCR\b", s)),
        "BAL": bool(re.search(r"BALANCE|CLOSING\s*BALANCE|ACCOUNT\s*BALANCE", s)),
        "REF": bool(re.search(r"CHQ|CHEQUE|REF|UTR", s)),
    }
    score = 0.0
    score += 1.0 if tokens["DATE"] else 0.0
    score += 1.0 if tokens["NARR"] else 0.0
    score += 1.0 if tokens["DR"] else 0.0
    score += 1.0 if tokens["CR"] else 0.0
    score += 1.0 if tokens["BAL"] else 0.0
    score += 0.5 if tokens["REF"] else 0.0
    return score / 5.5
