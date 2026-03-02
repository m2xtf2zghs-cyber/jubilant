from __future__ import annotations

import argparse
from pathlib import Path

from core.amount_date_parsers import infer_dr_cr, parse_amount, parse_date
from core.bank_adapter_base import RawRow, StatementMetadata
from core.bank_adapter_registry import extract_statement
from excel.writer_xns_only import ErrorRow, ReconRow, write_xns_only_workbook


def run_xns_only(pdf_path: str, out_path: str) -> None:
    rows: list[RawRow] = []
    errors: list[ErrorRow] = []
    adapter_code = "UNKNOWN"
    meta = StatementMetadata()

    try:
        extracted = extract_statement(pdf_path)
        rows = extracted.rows
        adapter_code = extracted.adapter_code
        meta = extracted.doc.metadata
    except Exception as exc:
        errors.append(
            ErrorRow(
                severity="FAIL",
                code="EXTRACT_FAIL",
                message=str(exc),
                source_file=pdf_path,
            )
        )

    total_dr = 0.0
    total_cr = 0.0
    date_fail = 0
    bal_fail = 0
    bal_present = 0

    for row in rows:
        try:
            _ = parse_date(row.txn_date_str)
        except Exception:
            date_fail += 1

        dr, cr = infer_dr_cr(row.debit_str, row.credit_str)
        total_dr += dr
        total_cr += cr

        if row.balance_str is not None and str(row.balance_str).strip():
            bal_present += 1
            try:
                _ = parse_amount(row.balance_str)
            except Exception:
                bal_fail += 1

    status = "FAIL" if any(err.severity == "FAIL" for err in errors) else "PASS"
    notes = "Phase-1: no footer totals; only computed totals."

    if date_fail > 0:
        if status != "FAIL":
            status = "WARN"
        errors.append(ErrorRow("WARN", "DATE_PARSE", f"{date_fail} date parse failures", pdf_path))

    if bal_fail > 0:
        if status != "FAIL":
            status = "WARN"
        errors.append(ErrorRow("WARN", "BAL_PARSE", f"{bal_fail} balance parse failures", pdf_path))

    recon = ReconRow(
        source_file=pdf_path,
        adapter_code=adapter_code,
        parsed_rows=len(rows),
        total_dr_rupees=total_dr,
        total_cr_rupees=total_cr,
        balance_rows_present=bal_present,
        balance_parse_failures=bal_fail,
        date_parse_failures=date_fail,
        status=status,
        notes=notes,
    )

    write_xns_only_workbook(
        out_path=out_path,
        statement_name="STATEMENT",
        meta=meta,
        adapter_code=adapter_code,
        rows=rows,
        errors=errors,
        recon=recon,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Money Lender Statement Analyser phase-1 XNS-only CLI")
    parser.add_argument("pdf_path", help="Input PDF statement path")
    parser.add_argument("out_path", help="Output XLSX path")
    args = parser.parse_args()

    Path(args.out_path).parent.mkdir(parents=True, exist_ok=True)
    run_xns_only(args.pdf_path, args.out_path)
    print(f"done out={args.out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
