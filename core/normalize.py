from __future__ import annotations

import hashlib
import re
from datetime import date
from typing import Any

from core.amount_date_parsers import infer_dr_cr, parse_amount, parse_date
from core.canonical_models import AccountBundle, CanonicalTransaction
from core.party_clean import clean_party
from core.party_extract_regex import BILL_ID, JL_DISP, LOAN_COLL, extract_party


_REF_RE = re.compile(r"\b([A-Z]{4}[A-Z0-9]{8,30}|[A-Z0-9]{10,30})\b")
_UTR_RE = re.compile(r"\b([A-Z]{4}R\d{10,30}|[A-Z]{4}N\d{10,30}|UTR[:\-/ ]*[A-Z0-9]{8,30})\b", re.IGNORECASE)
_CHEQUE_RE = re.compile(r"(?i)\b(?:CHQ|CHEQUE|CHQ NO|CHEQUE NO)[:\-/ ]*([A-Z0-9]{4,20})\b")


def _cfg_get(config: dict[str, Any], *path: str, default: Any = None) -> Any:
    cur: Any = config
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def normalize_narration(text: str) -> str:
    s = (text or "").upper()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def month_label(txn_date: date, config: dict[str, Any]) -> str:
    use_suffix = bool(_cfg_get(config, "month_labels", "use_year_suffix_from_jan", default=True))
    jan_fmt = _cfg_get(config, "month_labels", "jan_suffix_format", default="JAN({yy})")
    feb_fmt = _cfg_get(config, "month_labels", "feb_suffix_format", default="FEB({yy})")
    mar_fmt = _cfg_get(config, "month_labels", "mar_suffix_format", default="MAR({yy})")
    yy = f"{txn_date.year % 100:02d}"
    if use_suffix and txn_date.month == 1:
        return str(jan_fmt).replace("{yy}", yy)
    if use_suffix and txn_date.month == 2:
        return str(feb_fmt).replace("{yy}", yy)
    if use_suffix and txn_date.month == 3:
        return str(mar_fmt).replace("{yy}", yy)
    return txn_date.strftime("%b").upper()


def detect_channel(narr_norm: str, config: dict[str, Any]) -> str:
    buckets = {
        "RTGS": _cfg_get(config, "channels", "rtgs_keywords", default=["RTGS"]),
        "NEFT": _cfg_get(config, "channels", "neft_keywords", default=["NEFT", "NECS"]),
        "IMPS": _cfg_get(config, "channels", "imps_keywords", default=["IMPS"]),
        "UPI": _cfg_get(config, "channels", "upi_keywords", default=["UPI"]),
        "CASH": _cfg_get(config, "channels", "cash_keywords", default=["CASH", "ATM", "CS/", "CHEPA", "SELF"]),
        "INTERNAL": _cfg_get(config, "channels", "internal_keywords", default=["TR/CHEPA", "TR TO", "TR FROM", "EBANK/TR"]),
    }
    for ch, words in buckets.items():
        for w in words:
            if str(w).upper() in narr_norm:
                return ch
    if "CHQ" in narr_norm or "CHEQUE" in narr_norm:
        return "CHEQUE"
    return "OTHER"


def extract_refs(narr_raw: str, cheque_hint: str | None = None) -> tuple[str | None, str | None, str | None]:
    s = narr_raw or ""
    cheque_no = cheque_hint
    if cheque_no is None:
        m = _CHEQUE_RE.search(s)
        if m:
            cheque_no = m.group(1)

    utr = None
    m2 = _UTR_RE.search(s)
    if m2:
        utr = m2.group(1).replace("UTR", "").replace(":", "").strip(" -/")

    ref_no = None
    m3 = _REF_RE.search(s.upper())
    if m3:
        ref_no = m3.group(1)

    return cheque_no, ref_no, utr


def _normalize_party_alias(party: str | None, config: dict[str, Any]) -> str | None:
    if not party:
        return None
    alias_map = _cfg_get(config, "entity_dedup", "alias_map", default={})
    if not alias_map:
        alias_map = _cfg_get(config, "entity_alias_map", default={})
    p = party.upper().strip()
    if p in alias_map:
        return str(alias_map[p]).upper()
    for k, v in alias_map.items():
        if str(k).upper() in p:
            return str(v).upper()
    return p


def extract_party_name(narr_norm: str, config: dict[str, Any]) -> str | None:
    hit = extract_party(narr_norm)
    p = hit.party

    if p is None:
        m = LOAN_COLL.search(narr_norm)
        if m:
            loan = m.group("loan")
            return f"LOAN -{loan[-4:]}"
        m = JL_DISP.search(narr_norm)
        if m:
            loan = m.group("loan")
            return f"GOLD LOAN DISBURSED -{loan[-4:]}"
        m = BILL_ID.search(narr_norm)
        if m:
            return f"BILL ID -{m.group('bill')}"

    stopwords = _cfg_get(config, "counterparty_stopwords", default=[])
    p = clean_party(p, stopwords)
    p = _normalize_party_alias(p, config)
    return p


def stable_txn_uid(
    bank_name: str,
    account_no_masked: str,
    txn_date: date,
    dr_amount: float,
    cr_amount: float,
    narration_norm: str,
    ref_no: str | None,
) -> str:
    payload = "|".join(
        [
            bank_name.upper(),
            account_no_masked.upper(),
            txn_date.isoformat(),
            f"{dr_amount:.2f}",
            f"{cr_amount:.2f}",
            narration_norm,
            (ref_no or "").upper(),
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def raw_to_canonical(statement: Any, config: dict[str, Any]) -> AccountBundle:
    meta = statement.doc.metadata
    bank = (meta.bank_name or statement.adapter_code or "GENERIC").upper()
    acct_mask = meta.account_no_masked or "XXXX"
    acct_type = (meta.account_type or "CA").upper()
    holder = meta.account_holder or "UNKNOWN"
    # keep stable identifier
    last = re.sub(r"\D", "", acct_mask)[-4:] if re.sub(r"\D", "", acct_mask) else acct_mask[-4:]
    account_id = f"{bank}-{last}-{acct_type}"

    txns: list[CanonicalTransaction] = []
    for idx, row in enumerate(statement.rows, start=1):
        try:
            dt = parse_date(row.txn_date_str)
        except Exception:
            # deterministic fallback date for parse failures; recon will flag
            dt = date(1900, 1, 1)

        narr_raw = row.narration or ""
        narr_norm = normalize_narration(narr_raw)
        dr, cr = infer_dr_cr(row.debit_str, row.credit_str)
        bal: float | None
        if row.balance_str is None or str(row.balance_str).strip() == "":
            bal = None
        else:
            try:
                bal = parse_amount(row.balance_str)
            except Exception:
                bal = None

        cheque_no, ref_no, utr = extract_refs(narr_raw, row.cheque_ref_str)
        party = extract_party_name(narr_norm, config)
        channel = detect_channel(narr_norm, config)

        uid = stable_txn_uid(bank, acct_mask, dt, dr, cr, narr_norm, ref_no)
        txns.append(
            CanonicalTransaction(
                txn_uid=uid,
                source_file=statement.doc.filepath,
                source_page=row.source_page,
                source_line=row.source_line,
                statement_order=idx,
                bank_name=bank,
                account_holder=holder,
                account_no_masked=acct_mask,
                account_type=acct_type,
                account_id=account_id,
                txn_date=dt,
                month_label=month_label(dt, config),
                narration_raw=narr_raw,
                narration_norm=narr_norm,
                cheque_no=cheque_no,
                ref_no=ref_no,
                utr=utr,
                dr_amount=round(dr, 2),
                cr_amount=round(cr, 2),
                balance=bal,
                channel=channel,
                type_code="DOUBT",
                category_clean=party or "DOUBT",
                rule_id="UNCLASSIFIED",
                confidence="LOW",
                matched_tokens=[],
                flags=[],
            )
        )

    return AccountBundle(
        account_id=account_id,
        bank_name=bank,
        account_holder=holder,
        account_no_masked=acct_mask,
        account_type=acct_type,
        source_file=statement.doc.filepath,
        transactions=txns,
    )
