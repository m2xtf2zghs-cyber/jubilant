from __future__ import annotations

from app.core.domain import CanonicalTransaction
from app.narration.channel import infer_channel, infer_purpose
from app.narration.cleaner import clean_narration
from app.narration.extractor import extract_narration_fields
from app.parsers.generic.statement_parser import GenericStatementParser
from app.parsers.interfaces import ParsedStatement
from app.utils.dates import month_key, parse_date
from app.utils.money import parse_amount


class TransactionNormalizer:
    def __init__(self, config: dict):
        self.config = config

    def normalize(self, job_id: str, parsed: ParsedStatement) -> list[CanonicalTransaction]:
        txns: list[CanonicalTransaction] = []
        prev_balance: float | None = None

        for row in parsed.rows:
            txn_date = parse_date(row.txn_date_text)
            value_date = parse_date(row.value_date_text) if row.value_date_text else None
            cleaned = clean_narration(row.narration)
            fields = extract_narration_fields(row.narration)
            balance = parse_amount(row.balance_text) if row.balance_text else None
            debit, credit = GenericStatementParser.infer_dr_cr(
                row.debit_text,
                row.credit_text,
                row.amount_text,
                prev_balance,
                balance,
            )

            # First-row ambiguity in layouts where amount side is implicit.
            if (
                prev_balance is None
                and row.amount_text
                and not row.debit_text
                and not row.credit_text
                and debit > 0
                and credit == 0
            ):
                up = cleaned
                if any(k in up for k in ("RTGS/", "NEFT/", "IMPS/", "UPI/", "TR/CHEPA/", "EBANK/TR FROM")):
                    credit = debit
                    debit = 0.0

            if balance is not None:
                prev_balance = balance

            direction = "ZERO"
            if debit > 0:
                direction = "DEBIT"
            elif credit > 0:
                direction = "CREDIT"

            txns.append(
                CanonicalTransaction(
                    job_id=job_id,
                    source_file=parsed.source_file,
                    source_bank=parsed.metadata.source_bank or "GENERIC",
                    source_account_no=parsed.metadata.source_account_no,
                    source_account_name=parsed.metadata.source_account_name,
                    source_account_type=parsed.metadata.source_account_type,
                    page_no=row.page_no,
                    line_ref=row.line_ref,
                    txn_date=txn_date,
                    value_date=value_date,
                    cheque_no=row.cheque_no or fields.cheque_no,
                    raw_narration=row.narration,
                    cleaned_narration=cleaned,
                    debit=round(debit, 2),
                    credit=round(credit, 2),
                    balance=balance,
                    direction=direction,
                    month_key=month_key(txn_date),
                    inferred_party=fields.inferred_party,
                    normalized_party=fields.inferred_party,
                    txn_channel=infer_channel(cleaned, self.config),
                    txn_purpose=infer_purpose(cleaned, self.config),
                    classification_primary="UNKNOWN",
                    confidence_score=float(self.config.get("thresholds", {}).get("confidence_default", 0.4)),
                )
            )
            if not txns[-1].inferred_party and txns[-1].txn_channel in {"RTGS", "NEFT", "IMPS", "UPI"}:
                txns[-1].counterparty_type = "UNRESOLVED_CHANNEL_PARTY"
        return txns
