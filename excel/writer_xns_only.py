from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import xlsxwriter

from core.amount_date_parsers import amount_to_lakhs, infer_dr_cr, parse_amount, parse_date
from core.bank_adapter_base import RawRow, StatementMetadata


@dataclass
class ReconRow:
    source_file: str
    adapter_code: str
    parsed_rows: int
    total_dr_rupees: float
    total_cr_rupees: float
    balance_rows_present: int
    balance_parse_failures: int
    date_parse_failures: int
    status: str  # PASS/WARN/FAIL
    notes: str


@dataclass
class ErrorRow:
    severity: str  # FAIL/WARN
    code: str
    message: str
    source_file: str
    page_no: Optional[int] = None
    line_no: Optional[int] = None


def write_xns_only_workbook(
    out_path: str,
    statement_name: str,
    meta: StatementMetadata,
    adapter_code: str,
    rows: List[RawRow],
    errors: List[ErrorRow],
    recon: ReconRow,
    lakhs_divisor: float = 100000.0,
) -> None:
    wb = xlsxwriter.Workbook(out_path)

    # Formats
    fmt_header = wb.add_format({"bold": True, "bg_color": "#D9E1F2", "border": 1})
    fmt_cell = wb.add_format({"border": 1})
    fmt_money_lakhs = wb.add_format({"num_format": "0.00", "border": 1})
    fmt_money_rupees = wb.add_format({"num_format": "#,##,##0.00", "border": 1})
    fmt_fail = wb.add_format({"font_color": "white", "bg_color": "#C00000", "border": 1})
    fmt_warn = wb.add_format({"bg_color": "#FFF2CC", "border": 1})
    fmt_title = wb.add_format({"bold": True, "font_size": 14})

    # Sheet: ANALYSIS (minimal for now)
    sh_an = wb.add_worksheet("ANALYSIS")
    sh_an.freeze_panes(1, 0)

    sh_an.write(0, 0, "Summary Info", fmt_title)
    info = [
        ("Statement Name", statement_name),
        ("Bank", meta.bank_name or ""),
        ("Account Holder", meta.account_holder or ""),
        ("Account No (masked)", meta.account_no_masked or ""),
        ("Account Type", meta.account_type or ""),
        ("Period From", meta.period_from.isoformat() if meta.period_from else ""),
        ("Period To", meta.period_to.isoformat() if meta.period_to else ""),
        ("Adapter", adapter_code),
        ("Parsed Rows", recon.parsed_rows),
        ("Total DR (₹)", recon.total_dr_rupees),
        ("Total CR (₹)", recon.total_cr_rupees),
        ("Recon Status", recon.status),
        ("Recon Notes", recon.notes),
    ]
    for i, (k, v) in enumerate(info, start=2):
        sh_an.write(i, 0, k, fmt_header)
        sh_an.write(i, 1, v, fmt_cell)

    # Sheet: XNS (single account mode; multi-account will expand later)
    sh_xns = wb.add_worksheet("XNS")
    sh_xns.freeze_panes(1, 0)

    headers = [
        "Sl. No.",
        "Date",
        "MONTH",
        "TYPE",
        "Cheque_No",
        "Category",
        "Description",
        "DR (Lakhs)",
        "CR (Lakhs)",
        "Balance (₹)",
        "SourceFile",
        "PageNo",
        "LineNo",
    ]
    for c, h in enumerate(headers):
        sh_xns.write(0, c, h, fmt_header)

    total_dr = 0.0
    total_cr = 0.0

    for idx, r in enumerate(rows, start=1):
        # For parsing-stability phase, keep TYPE/Category blank placeholders
        # Classification comes later.
        try:
            d = parse_date(r.txn_date_str)
            date_str = d.strftime("%d/%m/%Y")
            month = d.strftime("%b").upper()
        except Exception:
            date_str = r.txn_date_str
            month = ""

        dr, cr = infer_dr_cr(r.debit_str, r.credit_str)
        total_dr += dr
        total_cr += cr

        bal = 0.0
        bal_ok = True
        if r.balance_str is None:
            bal_ok = False
        else:
            try:
                bal = parse_amount(r.balance_str)
            except Exception:
                bal_ok = False

        sh_xns.write(idx, 0, idx, fmt_cell)
        sh_xns.write(idx, 1, date_str, fmt_cell)
        sh_xns.write(idx, 2, month, fmt_cell)
        sh_xns.write(idx, 3, "", fmt_cell)  # TYPE placeholder
        sh_xns.write(idx, 4, r.cheque_ref_str or "", fmt_cell)
        sh_xns.write(idx, 5, "", fmt_cell)  # Category placeholder
        sh_xns.write(idx, 6, r.narration, fmt_cell)

        sh_xns.write_number(idx, 7, amount_to_lakhs(dr, lakhs_divisor), fmt_money_lakhs)
        sh_xns.write_number(idx, 8, amount_to_lakhs(cr, lakhs_divisor), fmt_money_lakhs)
        if bal_ok:
            sh_xns.write_number(idx, 9, bal, fmt_money_rupees)
        else:
            sh_xns.write(idx, 9, "", fmt_warn)

        sh_xns.write(idx, 10, recon.source_file, fmt_cell)
        sh_xns.write_number(idx, 11, r.source_page, fmt_cell)
        sh_xns.write_number(idx, 12, r.source_line, fmt_cell)

    # Totals row
    trow = len(rows) + 1
    sh_xns.write(trow, 6, "TOTAL", fmt_header)
    sh_xns.write_number(trow, 7, amount_to_lakhs(total_dr, lakhs_divisor), fmt_header)
    sh_xns.write_number(trow, 8, amount_to_lakhs(total_cr, lakhs_divisor), fmt_header)

    # Sheet: ERRORS
    sh_err = wb.add_worksheet("ERRORS")
    sh_err.freeze_panes(1, 0)
    eheaders = ["Severity", "Code", "Message", "SourceFile", "PageNo", "LineNo"]
    for c, h in enumerate(eheaders):
        sh_err.write(0, c, h, fmt_header)
    for i, e in enumerate(errors, start=1):
        row_fmt = fmt_fail if e.severity == "FAIL" else fmt_warn
        sh_err.write(i, 0, e.severity, row_fmt)
        sh_err.write(i, 1, e.code, row_fmt)
        sh_err.write(i, 2, e.message, row_fmt)
        sh_err.write(i, 3, e.source_file, row_fmt)
        sh_err.write(i, 4, "" if e.page_no is None else e.page_no, row_fmt)
        sh_err.write(i, 5, "" if e.line_no is None else e.line_no, row_fmt)

    # Sheet: RECON
    sh_recon = wb.add_worksheet("RECON")
    sh_recon.freeze_panes(1, 0)
    rheaders = [
        "SourceFile",
        "Adapter",
        "ParsedRows",
        "TotalDR(₹)",
        "TotalCR(₹)",
        "BalanceRowsPresent",
        "BalanceParseFailures",
        "DateParseFailures",
        "Status",
        "Notes",
    ]
    for c, h in enumerate(rheaders):
        sh_recon.write(0, c, h, fmt_header)

    sh_recon.write(1, 0, recon.source_file, fmt_cell)
    sh_recon.write(1, 1, recon.adapter_code, fmt_cell)
    sh_recon.write_number(1, 2, recon.parsed_rows, fmt_cell)
    sh_recon.write_number(1, 3, recon.total_dr_rupees, fmt_money_rupees)
    sh_recon.write_number(1, 4, recon.total_cr_rupees, fmt_money_rupees)
    sh_recon.write_number(1, 5, recon.balance_rows_present, fmt_cell)
    sh_recon.write_number(1, 6, recon.balance_parse_failures, fmt_cell)
    sh_recon.write_number(1, 7, recon.date_parse_failures, fmt_cell)
    sh_recon.write(1, 8, recon.status, fmt_cell if recon.status == "PASS" else fmt_warn)
    sh_recon.write(1, 9, recon.notes, fmt_cell)

    wb.close()
