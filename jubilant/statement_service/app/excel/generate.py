from __future__ import annotations

from copy import copy
import datetime as dt
from pathlib import Path
from typing import Any, Dict, Iterable, List

from dateutil import parser as date_parser
from openpyxl import load_workbook


def _copy_row_style(ws, src_row: int, dst_row: int, max_col: int) -> None:
    for col in range(1, max_col + 1):
        src = ws.cell(row=src_row, column=col)
        dst = ws.cell(row=dst_row, column=col)
        dst._style = copy(src._style)
        dst.number_format = src.number_format
        dst.font = copy(src.font)
        dst.fill = copy(src.fill)
        dst.border = copy(src.border)
        dst.alignment = copy(src.alignment)
        dst.protection = copy(src.protection)


def _unique_sheet_title(workbook, desired_title: str) -> str:
    base = (desired_title or "SHEET").strip()[:31] or "SHEET"
    if base not in workbook.sheetnames:
        return base
    suffix = 1
    while True:
        suffix_text = f"-{suffix}"
        candidate = f"{base[:31 - len(suffix_text)]}{suffix_text}"
        if candidate not in workbook.sheetnames:
            return candidate
        suffix += 1


def _as_excel_date(value: Any):
    if value is None or value == "":
        return None
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    if isinstance(value, str):
        try:
            return date_parser.parse(value, dayfirst=True).date()
        except Exception:
            return value
    return value


def fill_xns_sheet(ws, start_row: int, txns: List[Dict[str, Any]], template_row: int) -> None:
    """
    Write transactions to XNS sheet while preserving template style by cloning a styled row.
    Column mapping is intentionally explicit and should match the workbook's XNS layout.
    """
    max_col = ws.max_column
    for i, txn in enumerate(txns):
        row = start_row + i
        if row > ws.max_row:
            ws.insert_rows(row)
        _copy_row_style(ws, template_row, row, max_col)

        ws.cell(row, 1).value = i + 1
        ws.cell(row, 2).value = _as_excel_date(txn.get("date"))
        ws.cell(row, 3).value = txn.get("month_label", "")
        ws.cell(row, 4).value = txn.get("txn_type", "")
        ws.cell(row, 5).value = txn.get("ref_no", "")
        ws.cell(row, 6).value = txn.get("category", "")
        ws.cell(row, 7).value = txn.get("narration", "")
        ws.cell(row, 8).value = float(txn.get("dr") or 0)
        ws.cell(row, 9).value = float(txn.get("cr") or 0)
        ws.cell(row, 10).value = float(txn.get("balance") or 0)


def fill_pivot_sheet(ws, start_row: int, pivot_rows: List[Dict[str, Any]], template_row: int) -> None:
    """
    Fill pivot sheet rows with a style-preserving copy pattern.
    Expected keys: month_key, category, txn_type, sum_dr, sum_cr, count_dr, count_cr.
    """
    max_col = ws.max_column
    for i, pivot in enumerate(pivot_rows):
        row = start_row + i
        if row > ws.max_row:
            ws.insert_rows(row)
        _copy_row_style(ws, template_row, row, max_col)

        ws.cell(row, 1).value = pivot.get("month_key", "")
        ws.cell(row, 2).value = pivot.get("category", "")
        ws.cell(row, 3).value = pivot.get("txn_type", "")
        ws.cell(row, 4).value = float(pivot.get("sum_dr") or 0)
        ws.cell(row, 5).value = float(pivot.get("sum_cr") or 0)
        ws.cell(row, 6).value = int(pivot.get("count_dr") or 0)
        ws.cell(row, 7).value = int(pivot.get("count_cr") or 0)


def _fill_value_rows(ws, start_row: int, rows: Iterable[Iterable[Any]]) -> None:
    for offset, row_values in enumerate(rows):
        row_no = start_row + offset
        for col_no, value in enumerate(row_values, start=1):
            ws.cell(row_no, col_no).value = value


def generate_perfios_excel(template_path: str, output_path: str, context: Dict[str, Any]) -> None:
    """
    Clone a formatted workbook template and write values into cloned sheets.
    Styles remain template-driven.
    """
    template = Path(template_path)
    if not template.exists():
        raise FileNotFoundError(f"Template workbook not found: {template}")

    wb = load_workbook(template)

    for account in context.get("accounts", []):
        xns_tpl_name = account["xns_template_sheet"]
        if xns_tpl_name not in wb.sheetnames:
            raise ValueError(f"XNS template sheet not found: {xns_tpl_name}")

        xns_template_ws = wb[xns_tpl_name]
        xns_ws = wb.copy_worksheet(xns_template_ws)
        xns_ws.title = _unique_sheet_title(wb, account.get("xns_sheet_name") or f"XNS-{len(wb.sheetnames)}")
        fill_xns_sheet(
            xns_ws,
            start_row=int(account.get("xns_start_row", 10)),
            txns=account.get("txns", []),
            template_row=int(account.get("xns_template_row", 10)),
        )

        pivot_tpl_name = account.get("pivot_template_sheet")
        if pivot_tpl_name and pivot_tpl_name in wb.sheetnames:
            pivot_template_ws = wb[pivot_tpl_name]
            pivot_ws = wb.copy_worksheet(pivot_template_ws)
            pivot_ws.title = _unique_sheet_title(
                wb,
                account.get("pivot_sheet_name") or f"PIVOT-{len(wb.sheetnames)}",
            )
            fill_pivot_sheet(
                pivot_ws,
                start_row=int(account.get("pivot_start_row", 2)),
                pivot_rows=account.get("pivots", []),
                template_row=int(account.get("pivot_template_row", 2)),
            )

    analysis_rows = context.get("analysis_rows") or []
    if analysis_rows and "ANALYSIS" in wb.sheetnames:
        _fill_value_rows(wb["ANALYSIS"], int(context.get("analysis_start_row", 2)), analysis_rows)

    wb.save(output_path)
