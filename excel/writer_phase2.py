from __future__ import annotations

from pathlib import Path
from typing import Any

import xlsxwriter

from core.amount_date_parsers import amount_to_lakhs
from core.canonical_models import CanonicalTransaction, ReconIssue, ReconSummary
from excel.pivot_builder import build_pivot_table


def _safe_sheet(name: str) -> str:
    return name[:31]


def _account_tag(txns: list[CanonicalTransaction]) -> str:
    if not txns:
        return "UNKNOWN-XXXX-CA"
    t = txns[0]
    digits = "".join(ch for ch in t.account_no_masked if ch.isdigit())
    last4 = digits[-4:] if len(digits) >= 4 else t.account_no_masked[-4:]
    return f"{t.bank_name}-{last4}-{t.account_type}".replace(" ", "")


def _build_formats(wb: xlsxwriter.Workbook, config: dict[str, Any]) -> dict[str, Any]:
    type_colors_cfg = config.get("formatting", {}).get("type_fill_colors", {})
    palette = {
        "green": "#C6EFCE",
        "orange_light": "#FCE4D6",
        "yellow": "#FFF2CC",
        "grey": "#D9D9D9",
        "blue": "#BDD7EE",
        "purple": "#E4DFEC",
        "orange_red": "#F8CBAD",
        "red": "#FFC7CE",
        "dark_red": "#C00000",
        "grey_light": "#EFEFEF",
        "blue_light": "#DDEBF7",
    }

    header = wb.add_format({"bold": True, "bg_color": "#D9E1F2", "border": 1})
    cell = wb.add_format({"border": 1})
    lakh2 = wb.add_format({"border": 1, "num_format": "0.00"})
    lakh5 = wb.add_format({"border": 1, "num_format": "0.00000"})
    rupee = wb.add_format({"border": 1, "num_format": "#,##,##0.00"})
    warn = wb.add_format({"border": 1, "bg_color": "#FFF2CC"})
    fail = wb.add_format({"border": 1, "bg_color": "#C00000", "font_color": "#FFFFFF"})
    subtotal = wb.add_format({"border": 1, "bold": True, "bg_color": "#F2F2F2"})
    grand = wb.add_format({"border": 2, "bold": True})
    overridden = wb.add_format({"border": 1, "bg_color": "#FFF2CC"})

    type_fmts: dict[str, Any] = {}
    for t, default_color in {
        "SALES": "green",
        "PURCHASE": "orange_light",
        "SIS CON": "yellow",
        "BANK FIN": "blue",
        "PVT FIN": "purple",
        "ODD FIG": "orange_red",
        "DOUBT": "red",
        "CASH": "grey",
        "EXPENSE": "grey_light",
        "RETURN": "dark_red",
        "INSURANCE": "blue_light",
    }.items():
        cname = str(type_colors_cfg.get(t, default_color))
        type_fmts[t] = wb.add_format({"border": 1, "bg_color": palette.get(cname, cname)})

    uw_bucket = {
        "OK": wb.add_format({"border": 1, "bg_color": "#C6EFCE"}),
        "WATCH": wb.add_format({"border": 1, "bg_color": "#FFF2CC"}),
        "RISK": wb.add_format({"border": 1, "bg_color": "#F8CBAD"}),
        "FRAUD_SUSPECT": wb.add_format({"border": 1, "bg_color": "#FFC7CE"}),
    }

    return {
        "header": header,
        "cell": cell,
        "lakh2": lakh2,
        "lakh5": lakh5,
        "rupee": rupee,
        "warn": warn,
        "fail": fail,
        "subtotal": subtotal,
        "grand": grand,
        "overridden": overridden,
        "type": type_fmts,
        "uw_bucket": uw_bucket,
    }


def _autosize(ws: xlsxwriter.workbook.Worksheet, rows: list[list[object]]) -> None:
    if not rows:
        return
    cols = max(len(r) for r in rows)
    for c in range(cols):
        width = 10
        for row in rows:
            if c < len(row):
                width = max(width, len(str(row[c])) + 2)
        ws.set_column(c, c, min(width, 60))


def _write_analysis_sheet(
    wb: xlsxwriter.Workbook,
    fmts: dict[str, Any],
    account_txns: dict[str, list[CanonicalTransaction]],
    account_analysis: dict[str, dict[str, Any]],
) -> None:
    ws = wb.add_worksheet("ANALYSIS")
    ws.freeze_panes(1, 0)
    hdr = ["Account", "Month", "Count", "DR", "CR", "Cash DR", "Cash CR", "Returns"]
    ws.write_row(0, 0, hdr, fmts["header"])
    buf = [hdr]

    r = 1
    for account_id in sorted(account_txns.keys()):
        stats = account_analysis.get(account_id, {})
        month_rows = stats.get("month_rows", [])
        for m in month_rows:
            row = [
                account_id,
                m.get("month", ""),
                int(m.get("count", 0)),
                float(m.get("dr", 0.0)),
                float(m.get("cr", 0.0)),
                float(m.get("cash_dr", 0.0)),
                float(m.get("cash_cr", 0.0)),
                int(m.get("returns", 0)),
            ]
            ws.write(r, 0, row[0], fmts["cell"])
            ws.write(r, 1, row[1], fmts["cell"])
            ws.write_number(r, 2, row[2], fmts["cell"])
            ws.write_number(r, 3, row[3], fmts["rupee"])
            ws.write_number(r, 4, row[4], fmts["rupee"])
            ws.write_number(r, 5, row[5], fmts["rupee"])
            ws.write_number(r, 6, row[6], fmts["rupee"])
            ws.write_number(r, 7, row[7], fmts["cell"])
            buf.append(row)
            r += 1
    _autosize(ws, buf)


def _write_xns_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], txns: list[CanonicalTransaction]) -> dict[str, float]:
    tag = _account_tag(txns)
    ws = wb.add_worksheet(_safe_sheet(f"XNS-{tag}"))
    ws.freeze_panes(1, 0)

    headers = [
        "SlNo",
        "Date",
        "MONTH",
        "TYPE",
        "Cheque_No",
        "Category",
        "Description",
        "DR(Lakhs)",
        "CR(Lakhs)",
        "Balance(₹)",
        "Confidence",
        "RuleID",
        "UW Bucket",
        "UW Score",
        "UW Reasons",
        "UW Tags",
        "UW Notes",
        "UW Risk Amt (Lakhs)",
        "UW Counterparty Risk",
        "Flags",
        "MatchedTokens",
        "SourceFile",
        "PageNo",
        "LineNo",
        "TxnUID",
    ]
    ws.write_row(0, 0, headers, fmts["header"])
    buf = [headers]

    ordered = sorted(txns, key=lambda t: (t.txn_date, t.statement_order, t.source_page, t.source_line))
    total_dr = 0.0
    total_cr = 0.0

    for i, t in enumerate(ordered, start=1):
        total_dr += t.dr_amount
        total_cr += t.cr_amount

        row = [
            i,
            t.txn_date.isoformat(),
            t.month_label,
            t.type_code,
            t.cheque_no or "",
            t.category_clean,
            t.narration_raw,
            amount_to_lakhs(t.dr_amount),
            amount_to_lakhs(t.cr_amount),
            t.balance if t.balance is not None else "",
            t.confidence,
            t.rule_id,
            t.uw_bucket,
            t.uw_score,
            ",".join(t.uw_reasons),
            ",".join(t.uw_tags),
            t.uw_notes,
            amount_to_lakhs(t.uw_amt_risk),
            t.uw_counterparty_risk,
            ",".join(t.flags),
            ",".join(t.matched_tokens),
            t.source_file,
            t.source_page,
            t.source_line,
            t.txn_uid,
        ]
        base = fmts["overridden"] if t.override_applied else fmts["cell"]

        ws.write_number(i, 0, row[0], base)
        ws.write(i, 1, row[1], base)
        ws.write(i, 2, row[2], base)
        ws.write(i, 3, row[3], fmts["type"].get(t.type_code, base))
        ws.write(i, 4, row[4], base)
        ws.write(i, 5, row[5], base)
        ws.write(i, 6, row[6], base)
        ws.write_number(i, 7, float(row[7]), fmts["lakh2"])
        ws.write_number(i, 8, float(row[8]), fmts["lakh2"])
        if t.balance is None:
            ws.write(i, 9, "", base)
        else:
            ws.write_number(i, 9, float(t.balance), fmts["rupee"])
        ws.write(i, 10, row[10], base)
        ws.write(i, 11, row[11], base)
        ws.write(i, 12, row[12], fmts["uw_bucket"].get(t.uw_bucket, base))
        ws.write_number(i, 13, int(row[13]), base)
        ws.write(i, 14, row[14], base)
        ws.write(i, 15, row[15], base)
        ws.write(i, 16, row[16], base)
        ws.write_number(i, 17, float(row[17]), fmts["lakh2"])
        ws.write(i, 18, row[18], base)
        ws.write(i, 19, row[19], base)
        ws.write(i, 20, row[20], base)
        ws.write(i, 21, row[21], base)
        ws.write_number(i, 22, int(row[22]), base)
        ws.write_number(i, 23, int(row[23]), base)
        ws.write(i, 24, row[24], base)

        buf.append(row)

    tr = len(ordered) + 1
    ws.write(tr, 6, "TOTAL", fmts["header"])
    ws.write_number(tr, 7, amount_to_lakhs(total_dr), fmts["header"])
    ws.write_number(tr, 8, amount_to_lakhs(total_cr), fmts["header"])

    _autosize(ws, buf)
    return {"total_dr": total_dr, "total_cr": total_cr}


def _write_pivot_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], txns: list[CanonicalTransaction]) -> dict[str, float]:
    tag = _account_tag(txns)
    ws = wb.add_worksheet(_safe_sheet(f"PIVOT-{tag}"))
    ws.freeze_panes(1, 0)

    pivot = build_pivot_table(txns)
    columns = list(pivot["columns"])
    ws.write_row(0, 0, columns, fmts["header"])

    rows = list(pivot["rows"])
    r = 1
    for row in rows:
        is_sub = row.get("CATEGORY") == "SUBTOTAL"
        fmt = fmts["subtotal"] if is_sub else fmts["cell"]
        for c, col in enumerate(columns):
            val = row.get(col, "")
            if isinstance(val, (int, float)):
                num_fmt = fmts["lakh5"] if col.endswith("_DR") or col.endswith("_CR") or col.startswith("TOTAL") else fmt
                ws.write_number(r, c, float(val), num_fmt)
            else:
                ws.write(r, c, str(val), fmt)
        r += 1

    grand = pivot["grand"]
    for c, col in enumerate(columns):
        val = grand.get(col, "")
        if isinstance(val, (int, float)):
            ws.write_number(r, c, float(val), fmts["grand"])
        else:
            ws.write(r, c, str(val), fmts["grand"])

    _autosize(ws, [columns] + [[row.get(c, "") for c in columns] for row in rows])
    return {
        "total_dr_lakhs": float(grand.get("TOTAL_DR", 0.0)),
        "total_cr_lakhs": float(grand.get("TOTAL_CR", 0.0)),
    }


def _write_category_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], name: str, txns: list[CanonicalTransaction]) -> None:
    ws = wb.add_worksheet(_safe_sheet(name))
    ws.freeze_panes(1, 0)
    hdr = ["Date", "MONTH", "TYPE", "Cheque_No", "Category", "DR(Lakhs)", "CR(Lakhs)", "Description", "Account_ID"]
    ws.write_row(0, 0, hdr, fmts["header"])

    ordered = sorted(txns, key=lambda t: (t.category_clean, t.txn_date, t.statement_order))
    buf = [hdr]
    r = 1
    current = None
    sub_dr = 0.0
    sub_cr = 0.0
    for t in ordered:
        if current is None:
            current = t.category_clean
        if current != t.category_clean:
            ws.write(r, 4, f"SUBTOTAL {current}", fmts["subtotal"])
            ws.write_number(r, 5, amount_to_lakhs(sub_dr), fmts["subtotal"])
            ws.write_number(r, 6, amount_to_lakhs(sub_cr), fmts["subtotal"])
            r += 1
            current = t.category_clean
            sub_dr = 0.0
            sub_cr = 0.0

        dr = amount_to_lakhs(t.dr_amount)
        cr = amount_to_lakhs(t.cr_amount)
        sub_dr += t.dr_amount
        sub_cr += t.cr_amount
        row = [t.txn_date.isoformat(), t.month_label, t.type_code, t.cheque_no or "", t.category_clean, dr, cr, t.narration_raw, t.account_id]
        ws.write_row(r, 0, row, fmts["cell"])
        ws.write_number(r, 5, dr, fmts["lakh2"])
        ws.write_number(r, 6, cr, fmts["lakh2"])
        buf.append(row)
        r += 1

    if current is not None:
        ws.write(r, 4, f"SUBTOTAL {current}", fmts["subtotal"])
        ws.write_number(r, 5, amount_to_lakhs(sub_dr), fmts["subtotal"])
        ws.write_number(r, 6, amount_to_lakhs(sub_cr), fmts["subtotal"])

    _autosize(ws, buf)


def _write_cons_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], cons_rows: list[dict[str, Any]]) -> None:
    ws = wb.add_worksheet("CONS")
    ws.freeze_panes(1, 0)
    if not cons_rows:
        ws.write_row(0, 0, ["MONTH"], fmts["header"])
        return

    cols = ["MONTH"] + [c for c in cons_rows[0].keys() if c != "MONTH"]
    ws.write_row(0, 0, cols, fmts["header"])
    buf = [cols]
    for r, row in enumerate(cons_rows, start=1):
        for c, col in enumerate(cols):
            val = row.get(col, "")
            if isinstance(val, bool):
                ws.write(r, c, "YES" if val else "", fmts["warn"] if val else fmts["cell"])
            elif isinstance(val, (int, float)):
                ws.write_number(r, c, amount_to_lakhs(float(val)) if col.endswith("_TOTAL") or col.endswith("_PURCHASE") or col.endswith("_SALES") else float(val), fmts["lakh2"] if col.endswith("_TOTAL") or col.endswith("_PURCHASE") or col.endswith("_SALES") else fmts["cell"])
            else:
                ws.write(r, c, str(val), fmts["cell"])
        buf.append([row.get(c, "") for c in cols])
    _autosize(ws, buf)


def _write_final_sheet(
    wb: xlsxwriter.Workbook,
    fmts: dict[str, Any],
    final_summary: dict[str, Any],
    underwriting_rollups: dict[str, Any],
) -> None:
    ws = wb.add_worksheet("FINAL")
    ws.freeze_panes(1, 0)

    metrics = [
        ("Avg Monthly Sales", final_summary.get("avg_monthly_sales", 0.0)),
        ("Avg Monthly Purchase", final_summary.get("avg_monthly_purchase", 0.0)),
        ("Purchase/Sales Ratio", final_summary.get("purchase_sales_ratio", 0.0)),
        ("Cash Withdrawal % of Sales", final_summary.get("cash_withdrawal_pct_of_sales", 0.0)),
        ("Bank Finance Avg Monthly Outflow", final_summary.get("bank_fin_avg_monthly_outflow", 0.0)),
        ("Private Finance Avg Monthly Outflow", final_summary.get("pvt_fin_avg_monthly_outflow", 0.0)),
        ("Assessed Turnover", final_summary.get("assessed_turnover", 0.0)),
        ("Eligible Loan Suggestion", final_summary.get("eligible_loan_suggestion", 0.0)),
    ]
    ws.write_row(0, 0, ["Metric", "Value"], fmts["header"])
    for i, (k, v) in enumerate(metrics, start=1):
        ws.write(i, 0, k, fmts["cell"])
        ws.write_number(i, 1, float(v), fmts["rupee"])

    start = len(metrics) + 3
    ws.write(start, 0, "Risk Flags", fmts["header"])
    for i, flag in enumerate(final_summary.get("risk_flags", []), start=start + 1):
        ws.write(i, 0, str(flag), fmts["warn"])

    mismatch = final_summary.get("sis_con_mismatch", [])
    mstart = start + max(len(final_summary.get("risk_flags", [])), 1) + 3
    ws.write_row(mstart, 0, ["SIS CON From", "SIS CON To", "A->B", "B->A", "Delta", "Delta%", "Flag"], fmts["header"])
    for i, row in enumerate(mismatch, start=mstart + 1):
        ws.write_row(
            i,
            0,
            [row.get("from", ""), row.get("to", ""), row.get("a_to_b", 0.0), row.get("b_to_a", 0.0), row.get("delta", 0.0), row.get("delta_pct", 0.0), row.get("flag", "")],
            fmts["cell"],
        )

    ustart = mstart + len(mismatch) + 3
    ws.write(ustart, 0, "UNDERWRITING OUTPUT", fmts["header"])
    uw_metrics = [
        ("UW Health Grade", final_summary.get("uw_health_grade", "N/A")),
        ("Fraud Suspicion Probability (%)", final_summary.get("uw_fraud_probability", 0.0)),
        ("Default Probability (%)", final_summary.get("uw_default_probability", 0.0)),
        ("Cash Leakage %", final_summary.get("uw_cash_leakage_pct", 0.0)),
        ("Hidden Liability Estimate (₹)", final_summary.get("uw_hidden_liability_estimate", 0.0)),
        ("Rotation Index", final_summary.get("uw_rotation_index", 0.0)),
        ("RISK txn count", final_summary.get("uw_risk_txn_count", 0)),
        ("FRAUD_SUSPECT txn count", final_summary.get("uw_fraud_suspect_txn_count", 0)),
    ]
    for i, (k, v) in enumerate(uw_metrics, start=ustart + 1):
        ws.write(i, 0, k, fmts["cell"])
        if isinstance(v, (int, float)):
            ws.write_number(i, 1, float(v), fmts["rupee"] if "Estimate" in k else fmts["cell"])
        else:
            ws.write(i, 1, str(v), fmts["cell"])

    sstart = ustart + len(uw_metrics) + 2
    ws.write(sstart, 0, "STREET LENDER VERDICT", fmts["header"])
    street_metrics = [
        ("Street Lender Verdict", final_summary.get("street_verdict", "HOLD")),
        ("Street Lender Limit Suggestion (₹ Lakhs)", amount_to_lakhs(float(final_summary.get("street_limit_suggested", 0.0)))),
        ("Street Haircut (%)", final_summary.get("street_haircut_pct", 0.0)),
        ("Reason Codes (Top 8)", ", ".join(final_summary.get("street_reason_codes", []))),
    ]
    for i, (k, v) in enumerate(street_metrics, start=sstart + 1):
        ws.write(i, 0, k, fmts["cell"])
        if isinstance(v, (int, float)):
            ws.write_number(i, 1, float(v), fmts["lakh2"] if "Suggestion" in k else fmts["cell"])
        else:
            ws.write(i, 1, str(v), fmts["cell"])

    cp_start = sstart + len(street_metrics) + 2
    ws.write(cp_start, 0, "Conditions Precedent (CPs)", fmts["header"])
    cps = final_summary.get("street_cps", [])
    if cps:
        for i, cp in enumerate(cps, start=cp_start + 1):
            ws.write(i, 0, str(cp), fmts["warn"])
    else:
        ws.write(cp_start + 1, 0, "None", fmts["cell"])

    mon_start = cp_start + max(len(cps), 1) + 2
    ws.write(mon_start, 0, "Monitoring Triggers", fmts["header"])
    monitors = final_summary.get("street_monitoring_triggers", [])
    if monitors:
        for i, mon in enumerate(monitors, start=mon_start + 1):
            ws.write(i, 0, str(mon), fmts["cell"])
    else:
        ws.write(mon_start + 1, 0, "None", fmts["cell"])

    astart = mon_start + max(len(monitors), 1) + 2
    ws.write_row(astart, 0, ["Account", "Grade", "Default%", "Fraud%", "CashLeak%", "HiddenLiability", "Rotation"], fmts["header"])
    for i, (acc, roll) in enumerate(sorted(underwriting_rollups.items()), start=astart + 1):
        ws.write_row(
            i,
            0,
            [
                acc,
                roll.uw_health_grade,
                roll.uw_default_probability,
                roll.uw_fraud_probability,
                roll.uw_cash_leakage_pct,
                roll.uw_hidden_liability_estimate_rupees,
                roll.uw_rotation_index,
            ],
            fmts["cell"],
        )

    cstart = astart + len(underwriting_rollups) + 2
    ws.write_row(cstart, 0, ["Top Counterparty", "UW Risk Amt (₹)"], fmts["header"])
    for i, item in enumerate(final_summary.get("top_counterparties", []), start=cstart + 1):
        ws.write(i, 0, str(item.get("counterparty", "")), fmts["cell"])
        ws.write_number(i, 1, float(item.get("uw_amt_risk", 0.0)), fmts["rupee"])


def _write_errors_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], errors: list[ReconIssue]) -> None:
    ws = wb.add_worksheet("ERRORS")
    ws.freeze_panes(1, 0)
    cols = ["Severity", "Code", "Message", "SourceFile", "PageNo", "LineNo", "TxnUID"]
    ws.write_row(0, 0, cols, fmts["header"])
    buf = [cols]
    for i, e in enumerate(errors, start=1):
        row = [e.severity, e.code, e.message, e.source_file, e.page_no or "", e.line_no or "", e.txn_uid or ""]
        fmt = fmts["fail"] if e.severity == "FAIL" else fmts["warn"] if e.severity == "WARN" else fmts["cell"]
        ws.write_row(i, 0, row, fmt)
        buf.append(row)
    _autosize(ws, buf)


def _write_recon_sheet(wb: xlsxwriter.Workbook, fmts: dict[str, Any], recon: list[ReconSummary], pivot_checks: list[dict[str, Any]]) -> None:
    ws = wb.add_worksheet("RECON")
    ws.freeze_panes(1, 0)
    cols = [
        "AccountID",
        "SourceFile",
        "ExpectedRows",
        "ParsedRows",
        "TotalDR",
        "TotalCR",
        "BalanceBreaks",
        "DateFailures",
        "Status",
        "Notes",
        "XNS_DR_Lakhs",
        "PIVOT_DR_Lakhs",
        "XNS_CR_Lakhs",
        "PIVOT_CR_Lakhs",
        "PivotMatch",
    ]
    ws.write_row(0, 0, cols, fmts["header"])
    buf = [cols]

    pivot_by_account = {p["account_id"]: p for p in pivot_checks}
    for i, r in enumerate(recon, start=1):
        p = pivot_by_account.get(r.account_id, {})
        xdr = p.get("xns_total_dr_lakhs", 0.0)
        pdr = p.get("pivot_total_dr_lakhs", 0.0)
        xcr = p.get("xns_total_cr_lakhs", 0.0)
        pcr = p.get("pivot_total_cr_lakhs", 0.0)
        match = abs(xdr - pdr) < 1e-8 and abs(xcr - pcr) < 1e-8

        row = [
            r.account_id,
            r.source_file,
            r.expected_rows,
            r.parsed_rows,
            r.total_dr,
            r.total_cr,
            r.balance_breaks,
            r.date_failures,
            r.status,
            r.notes,
            xdr,
            pdr,
            xcr,
            pcr,
            "PASS" if match else "FAIL",
        ]
        fmt = fmts["cell"] if r.status == "PASS" and match else fmts["warn"]
        ws.write_row(i, 0, row, fmt)
        buf.append(row)

    _autosize(ws, buf)


def write_phase2_workbook(
    out_path: str,
    *,
    account_txns: dict[str, list[CanonicalTransaction]],
    account_analysis: dict[str, dict[str, Any]],
    recon_summaries: list[ReconSummary],
    recon_issues: list[ReconIssue],
    cons_rows: list[dict[str, Any]],
    final_summary: dict[str, Any],
    underwriting_rollups: dict[str, Any],
    config: dict[str, Any],
) -> None:
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    wb = xlsxwriter.Workbook(out_path)
    fmts = _build_formats(wb, config)

    _write_analysis_sheet(wb, fmts, account_txns, account_analysis)

    pivot_checks: list[dict[str, Any]] = []
    category_buckets: dict[str, list[CanonicalTransaction]] = {
        "ODD FIG": [],
        "DOUBT": [],
        "BANK FIN": [],
        "PVT FIN": [],
        "RETURN": [],
    }

    for account_id, txns in account_txns.items():
        xns_totals = _write_xns_sheet(wb, fmts, txns)
        pivot_totals = _write_pivot_sheet(wb, fmts, txns)
        pivot_checks.append(
            {
                "account_id": account_id,
                "xns_total_dr_lakhs": amount_to_lakhs(xns_totals["total_dr"]),
                "xns_total_cr_lakhs": amount_to_lakhs(xns_totals["total_cr"]),
                "pivot_total_dr_lakhs": pivot_totals["total_dr_lakhs"],
                "pivot_total_cr_lakhs": pivot_totals["total_cr_lakhs"],
            }
        )

        for t in txns:
            if t.type_code in category_buckets:
                category_buckets[t.type_code].append(t)

    for name in ["ODD FIG", "DOUBT", "BANK FIN", "PVT FIN", "RETURN"]:
        _write_category_sheet(wb, fmts, name, category_buckets.get(name, []))

    if len(account_txns) >= 2:
        _write_cons_sheet(wb, fmts, cons_rows)

    _write_final_sheet(wb, fmts, final_summary, underwriting_rollups)
    _write_errors_sheet(wb, fmts, recon_issues)
    _write_recon_sheet(wb, fmts, recon_summaries, pivot_checks)

    wb.close()
