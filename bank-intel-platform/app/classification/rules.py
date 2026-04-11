from __future__ import annotations

from app.core.domain import CanonicalTransaction
from app.utils.money import is_round_figure


BANK_FIN_KEYWORDS = (
    "EMI",
    "NACH",
    "ECS",
    "LOAN COLL",
    "LOAN RECOVERY",
    "INT.COLL",
    "CERSAI",
    "PENAL",
    "ACHINWDR",
    "SUNDARAM FINANCE",
    "SUNDARAM HOME FINANCE",
    "TATA MOTORS FINANCE",
    "BAJAJ FINANCE",
    "IDFC FIRST BANK",
    "BILD-YESEMIPAY",
    "BILD-IDFCFIRSTBK",
    "TPSL-SUNDARAM FINANCE",
    "RAZORP-IDFC FIRST BANK",
    "CASHFRE",
    "GRIP RO",
    "SLMUD",
    "RSTOP",
    "STLOT",
)

EXPENSE_KEYWORDS = (
    "GST",
    "CBDT",
    "TIN",
    "TAX",
    "CCAV",
    "FFETOLL",
    "FIRSTFORWARD",
    "VAHAN",
    "TNEB",
    "EPFO",
    "CHARGES FOR PORD",
    "IMPS CHARGES",
    "SBIPAYECHALLAN",
    "BHARATKOSH",
    "BILD-GOOGLE",
    "BILD-TDTN",
    "RTO",
    "CHARGE",
    "CHARGES",
    "FEE",
    "STAMP",
    "CIBIL",
)

NAMES_KEYWORDS = (
    "SALARY",
    "WAGES",
    "DRIVER",
    "LOADING",
    "UNLOADING",
    "LABOUR",
    "LABOR",
    "STAFF",
)

INSURANCE_KEYWORDS = ("INSURANCE", "POLICY", "PREMIUM")
REVERSAL_KEYWORDS = ("REVERSAL", "REV/", "FAILED", "FAILURE REVERSAL")
TRANSFER_KEYWORDS = ("TR/CHEPA/", "EBANK/TR TO", "EBANK/TR FROM", "TRANSFER TO", "TRANSFER FROM", " BY TRF", " TO CC ")


def _party_name(txn: CanonicalTransaction) -> str:
    return (txn.normalized_party or txn.inferred_party or "").upper().strip()


def _is_transfer_like(narration: str) -> bool:
    return any(token in narration for token in TRANSFER_KEYWORDS)


def classify_txn(
    txn: CanonicalTransaction,
    related_entities: set[str] | None = None,
    sister_entities: set[str] | None = None,
    party_stats: dict[str, float] | None = None,
    learned_type: str | None = None,
) -> CanonicalTransaction:
    related_entities = related_entities or set()
    sister_entities = sister_entities or set()
    party_stats = party_stats or {}
    n = txn.cleaned_narration
    amount = txn.credit if txn.credit > 0 else txn.debit
    party = _party_name(txn)

    # Learned manual override: highest priority when signature is known.
    if learned_type:
        txn.classification_primary = learned_type
        txn.confidence_score = max(txn.confidence_score, 0.98)
        if learned_type == "SIS CON":
            txn.sister_concern_flag = True
        if learned_type == "BANK FIN":
            txn.bank_fin_flag = True
        if learned_type == "PVT FIN":
            txn.private_fin_flag = True
        if learned_type == "RETURN":
            txn.return_flag = True
        if learned_type == "ODD FIG":
            txn.odd_figure_flag = True
        if learned_type == "DOUBT":
            txn.doubt_flag = True
        return txn

    # Sister concern / internal transfer stays UNMATCH until reconciliation verifies it.
    if party and _is_transfer_like(n):
        if party in sister_entities:
            txn.classification_primary = "UNMATCH SIS CON"
            txn.sister_concern_flag = True
            txn.confidence_score = 0.92
            return txn
        if party in related_entities:
            txn.classification_primary = "UNMATCH INB TRF"
            txn.confidence_score = 0.9
            return txn
        if txn.debit > 0:
            txn.classification_primary = "PURCHASE"
        elif txn.credit > 0:
            txn.classification_primary = "SALES"
        txn.confidence_score = 0.72
        return txn

    # Returns / bounce
    if any(k in n for k in ("RTGSRET", "CHQ RET", "BOUNCE", "RETURNR", "RET CHG", "RETURN CHARGE")) or (
        "RETURN" in n and any(k in n for k in ("RTGS", "CHQ", "CHEQUE", "INW", "OUTW"))
    ):
        txn.classification_primary = "RETURN"
        txn.return_flag = True
        txn.confidence_score = 0.95
        return txn

    if any(k in n for k in REVERSAL_KEYWORDS):
        txn.classification_primary = "REVERSAL"
        txn.confidence_score = 0.92
        return txn

    # Bank finance
    if any(k in n for k in BANK_FIN_KEYWORDS):
        txn.classification_primary = "BANK FIN"
        txn.bank_fin_flag = True
        txn.confidence_score = 0.9
        return txn

    # Cash
    if any(k in n for k in ("CASH DEPOSIT", "CD/")):
        txn.classification_primary = "CASH"
        txn.classification_secondary = "CASH DEPOSIT"
        txn.confidence_score = 0.9
        return txn
    if any(k in n for k in ("CS/CHEPA", "CASH", "ATM", "SELF")) and "TR/CHEPA" not in n and txn.debit > 0:
        txn.classification_primary = "CASH"
        txn.classification_secondary = "CASH WITHDRAWAL"
        txn.confidence_score = 0.85
        return txn

    # Tax and charges
    if any(k in n for k in EXPENSE_KEYWORDS):
        txn.classification_primary = "EXPENSE"
        if any(k in n for k in ("GST", "CBDT", "TIN", "TAX", "VAHAN", "EPFO", "CHALLAN", "BHARATKOSH")):
            txn.classification_secondary = "TAX"
        txn.confidence_score = 0.8
        return txn

    # Insurance / staff
    if any(k in n for k in INSURANCE_KEYWORDS):
        txn.classification_primary = "INSURANCE"
        txn.confidence_score = 0.85
        return txn
    if any(k in n for k in NAMES_KEYWORDS):
        txn.classification_primary = "NAMES"
        txn.confidence_score = 0.8
        return txn
    if any(k in n for k in ("RENT", "EB BILL", "ELECTRICITY", "BROADBAND", "UTILITY")):
        txn.classification_primary = "EXPENSE"
        txn.classification_secondary = "OPERATING"
        txn.confidence_score = 0.75
        return txn

    # Round figure odd credits
    if txn.credit > 0 and amount >= 300000 and "LOAN REPAY" in n:
        txn.classification_primary = "ODD FIG"
        txn.odd_figure_flag = True
        txn.confidence_score = 0.8
        return txn

    if txn.credit > 0 and amount >= 100000 and is_round_figure(amount) and txn.classification_primary not in {"SIS CON", "BANK FIN", "INB TRF"}:
        credit_count = int(party_stats.get("credit_count", 0))
        debit_count = int(party_stats.get("debit_count", 0))
        # Keep frequent credit-only parties as SALES (manual working style).
        if debit_count == 0 and credit_count >= 2:
            txn.classification_primary = "SALES"
            txn.confidence_score = 0.7
            return txn
        if debit_count > 0 and amount >= 500000:
            txn.classification_primary = "ODD FIG"
            txn.odd_figure_flag = True
            txn.confidence_score = 0.75
            return txn

    # Basic purchase/sales fallback
    if txn.debit > 0 and txn.inferred_party:
        txn.classification_primary = "PURCHASE"
        txn.confidence_score = 0.65
        return txn
    if txn.credit > 0 and txn.inferred_party:
        txn.classification_primary = "SALES"
        txn.confidence_score = 0.65
        return txn

    # If channel-like narration exists but party extraction failed, keep business direction fallback.
    if txn.debit > 0 and any(k in n for k in ("NEFT", "RTGS", "IMPS", "UPI", "CLEARING", "TRANSFER", "OMN/TO")):
        txn.classification_primary = "PURCHASE"
        txn.confidence_score = 0.55
        return txn
    if txn.credit > 0 and any(k in n for k in ("NEFT", "RTGS", "IMPS", "UPI", "CLEARING", "TRANSFER")):
        txn.classification_primary = "SALES"
        txn.confidence_score = 0.55
        return txn

    # Unclear
    txn.classification_primary = "DOUBT"
    txn.doubt_flag = True
    txn.confidence_score = 0.4
    return txn
