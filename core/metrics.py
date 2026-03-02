from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict
from statistics import mean
from typing import Any

from core.canonical_models import CanonicalTransaction, ReconIssue, ReconSummary


def _month_sort_key(label: str) -> tuple[int, str]:
    months = {
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
    up = label.upper()
    base = up[:3]
    return months.get(base, 99), up


def account_recon(
    *,
    account_id: str,
    source_file: str,
    txns: list[CanonicalTransaction],
    expected_rows: int,
    config: dict[str, Any],
) -> tuple[ReconSummary, list[ReconIssue]]:
    issues: list[ReconIssue] = []
    parsed_rows = len(txns)
    total_dr = round(sum(t.dr_amount for t in txns), 2)
    total_cr = round(sum(t.cr_amount for t in txns), 2)

    hard_row = bool(config.get("reconciliation", {}).get("hard_fail_on_row_count_mismatch", True))
    bal_tol = float(config.get("reconciliation", {}).get("balance_tolerance_rupees", 0.01))

    status = "PASS"
    notes: list[str] = ["Computed totals (footer totals not parsed in phase-2 core)."]

    if parsed_rows != expected_rows:
        sev = "FAIL" if hard_row else "WARN"
        status = "FAIL" if sev == "FAIL" else "WARN"
        issues.append(
            ReconIssue(
                severity=sev,
                code="ROW_COUNT_MISMATCH",
                message=f"expected={expected_rows} parsed={parsed_rows}",
                source_file=source_file,
            )
        )

    # date parse failures (1900 fallback from normalize)
    date_failures = sum(1 for t in txns if t.txn_date.year == 1900)
    if date_failures:
        if status == "PASS":
            status = "WARN"
        issues.append(
            ReconIssue(
                severity="WARN",
                code="DATE_PARSE_FAILURE",
                message=f"rows with unparseable date={date_failures}",
                source_file=source_file,
            )
        )

    # balance continuity when balance present
    balance_breaks = 0
    ordered = sorted(txns, key=lambda t: (t.txn_date, t.statement_order, t.source_page, t.source_line))
    prev_bal: float | None = None
    for txn in ordered:
        if txn.balance is None:
            continue
        if prev_bal is None:
            prev_bal = txn.balance
            continue
        expected = round(prev_bal + txn.cr_amount - txn.dr_amount, 2)
        if abs(expected - txn.balance) > bal_tol:
            balance_breaks += 1
            issues.append(
                ReconIssue(
                    severity="WARN",
                    code="BALANCE_BREAK",
                    message=f"expected={expected:.2f} actual={txn.balance:.2f}",
                    source_file=txn.source_file,
                    page_no=txn.source_page,
                    line_no=txn.source_line,
                    txn_uid=txn.txn_uid,
                )
            )
        prev_bal = txn.balance

    if balance_breaks and status == "PASS":
        status = "WARN"

    # partial month indicator
    unique_months = sorted({t.month_label for t in txns}, key=_month_sort_key)
    if unique_months and len(unique_months) == 1:
        notes.append("PARTIAL_MONTH")

    summary = ReconSummary(
        account_id=account_id,
        source_file=source_file,
        expected_rows=expected_rows,
        parsed_rows=parsed_rows,
        total_dr=total_dr,
        total_cr=total_cr,
        balance_breaks=balance_breaks,
        date_failures=date_failures,
        status=status,
        notes=" | ".join(notes),
    )
    return summary, issues


def monthly_type_totals(txns: list[CanonicalTransaction]) -> dict[str, dict[str, dict[str, float]]]:
    out: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"DR": 0.0, "CR": 0.0}))
    for t in txns:
        bucket = out[t.type_code][t.month_label]
        bucket["DR"] += t.dr_amount
        bucket["CR"] += t.cr_amount
    return out


def compute_analysis(txns: list[CanonicalTransaction]) -> dict[str, Any]:
    by_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for t in txns:
        m = by_month[t.month_label]
        m["count"] += 1
        m["dr"] += t.dr_amount
        m["cr"] += t.cr_amount
        if t.type_code == "CASH":
            m["cash_dr"] += t.dr_amount
            m["cash_cr"] += t.cr_amount
        if t.type_code == "RETURN":
            m["returns"] += 1

    months = sorted(by_month.keys(), key=_month_sort_key)
    return {
        "months": months,
        "month_rows": [{"month": m, **{k: round(v, 2) for k, v in by_month[m].items()}} for m in months],
    }


def compute_sis_con_mismatch(txns: list[CanonicalTransaction], config: dict[str, Any]) -> list[dict[str, Any]]:
    tol_pct = float(config.get("sister_concerns", {}).get("mismatch", {}).get("tolerance_pct", 2))
    min_delta = float(config.get("sister_concerns", {}).get("mismatch", {}).get("min_delta_rupees", 5000))

    directed: dict[tuple[str, str], float] = defaultdict(float)
    for t in txns:
        if t.type_code != "SIS CON":
            continue
        parts = t.category_clean.split("-", 1)
        if len(parts) != 2:
            continue
        target = parts[1].strip()
        src = t.account_id
        if t.dr_amount > 0:
            directed[(src, target)] += t.dr_amount
        elif t.cr_amount > 0:
            directed[(target, src)] += t.cr_amount

    seen: set[frozenset[str]] = set()
    mismatches: list[dict[str, Any]] = []
    for (a, b), ab in directed.items():
        pair = frozenset((a, b))
        if pair in seen:
            continue
        seen.add(pair)
        ba = directed.get((b, a), 0.0)
        base = max(ab, ba, 1.0)
        delta = abs(ab - ba)
        pct = (delta / base) * 100.0
        if delta > min_delta and pct > tol_pct:
            mismatches.append(
                {
                    "from": a,
                    "to": b,
                    "a_to_b": round(ab, 2),
                    "b_to_a": round(ba, 2),
                    "delta": round(delta, 2),
                    "delta_pct": round(pct, 2),
                    "flag": "UNMATCH SIS CON",
                }
            )
    return mismatches


def compute_cons_by_month(account_txns: dict[str, list[CanonicalTransaction]]) -> list[dict[str, Any]]:
    months = set()
    for txns in account_txns.values():
        months.update(t.month_label for t in txns)
    ordered_months = sorted(months, key=_month_sort_key)

    rows: list[dict[str, Any]] = []
    for m in ordered_months:
        row: dict[str, Any] = {"MONTH": m}
        purchase_total = 0.0
        sales_total = 0.0
        for acc_id, txns in account_txns.items():
            p = sum(
                t.dr_amount
                for t in txns
                if t.month_label == m and t.type_code == "PURCHASE"
            )
            s = sum(
                t.cr_amount
                for t in txns
                if t.month_label == m and t.type_code == "SALES"
            )
            row[f"{acc_id}_PURCHASE"] = round(p, 2)
            row[f"{acc_id}_SALES"] = round(s, 2)
            purchase_total += p
            sales_total += s
        row["PURCHASE_TOTAL"] = round(purchase_total, 2)
        row["SALES_TOTAL"] = round(sales_total, 2)
        row["PURCHASE_GT_SALES"] = purchase_total > sales_total * 1.25 if sales_total > 0 else purchase_total > 0
        rows.append(row)
    return rows


def compute_final_summary(
    txns: list[CanonicalTransaction],
    config: dict[str, Any],
    sis_mismatch: list[dict[str, Any]],
) -> dict[str, Any]:
    by_month_sales: dict[str, float] = defaultdict(float)
    by_month_purchase: dict[str, float] = defaultdict(float)

    for t in txns:
        if t.type_code == "SALES":
            by_month_sales[t.month_label] += t.cr_amount
        elif t.type_code == "PURCHASE":
            by_month_purchase[t.month_label] += t.dr_amount

    sales_vals = list(by_month_sales.values())
    purchase_vals = list(by_month_purchase.values())
    avg_sales = round(mean(sales_vals), 2) if sales_vals else 0.0
    avg_purchase = round(mean(purchase_vals), 2) if purchase_vals else 0.0

    cash_withdraw = sum(t.dr_amount for t in txns if t.type_code == "CASH")
    odd_fig_cr = sum(t.cr_amount for t in txns if t.type_code == "ODD FIG")
    doubt_count = sum(1 for t in txns if t.type_code == "DOUBT")
    returns_count = sum(1 for t in txns if t.type_code == "RETURN")
    bank_fin_out = sum(t.dr_amount for t in txns if t.type_code == "BANK FIN")
    pvt_fin_out = sum(t.dr_amount for t in txns if t.type_code == "PVT FIN")

    total_sales = max(sum(sales_vals), 1.0)
    risk_cfg = config.get("risk_flags", {})
    odd_thresh = float(risk_cfg.get("odd_fig_credit_pct_threshold", 20))
    doubt_thresh = float(risk_cfg.get("doubt_txn_pct_threshold", 10))
    cash_thresh = float(risk_cfg.get("cash_withdrawal_pct_of_sales_threshold", 30))
    bounce_thresh = float(risk_cfg.get("cheque_bounce_per_month_threshold", 2))

    odd_pct = (odd_fig_cr / total_sales) * 100.0
    cash_pct = (cash_withdraw / total_sales) * 100.0
    doubt_pct = (doubt_count / max(len(txns), 1)) * 100.0

    flags: list[str] = []
    if odd_pct > odd_thresh:
        flags.append("ODD FIG > THRESHOLD")
    if doubt_pct > doubt_thresh:
        flags.append("DOUBT > THRESHOLD")
    if cash_pct > cash_thresh:
        flags.append("HIGH CASH LEAKAGE")
    if returns_count > bounce_thresh:
        flags.append("CHEQUE BOUNCES HIGH")
    if sis_mismatch:
        flags.append("SIS CON MISMATCH")

    return {
        "avg_monthly_sales": avg_sales,
        "avg_monthly_purchase": avg_purchase,
        "purchase_sales_ratio": round((avg_purchase / avg_sales), 4) if avg_sales else 0.0,
        "cash_withdrawal_pct_of_sales": round(cash_pct, 2),
        "bank_fin_avg_monthly_outflow": round(bank_fin_out / max(len(by_month_sales), 1), 2),
        "pvt_fin_avg_monthly_outflow": round(pvt_fin_out / max(len(by_month_sales), 1), 2),
        "assessed_turnover": round(avg_sales, 2),
        "eligible_loan_suggestion": round(avg_sales, 2),
        "risk_flags": flags,
        "sis_con_mismatch": sis_mismatch,
    }


def recon_table_rows(summaries: list[ReconSummary]) -> list[dict[str, Any]]:
    return [asdict(s) for s in summaries]
