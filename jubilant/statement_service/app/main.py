from __future__ import annotations

import datetime as dt
import hashlib
import os
import re
import tempfile
import uuid
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from dateutil import parser as date_parser
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openpyxl import load_workbook

from .config import settings
from .excel.generate import generate_perfios_excel
from .parser.extract import extract_raw_lines_pdfplumber, merge_multiline_transactions
from .parser.reconcile import reconcile_strict
from .supabase_client import sb


app = FastAPI(title="Statement Autopilot Service", version="1.0.0")

_origins_raw = os.environ.get("STATEMENT_SERVICE_CORS_ORIGINS", "*")
_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AMOUNT_RE = re.compile(r"-?\d[\d,]*(?:\.\d{1,2})?")


def _batch_insert(table: str, rows: List[Dict[str, Any]], size: int = 500) -> None:
    if not rows:
        return
    for i in range(0, len(rows), size):
        sb.table(table).insert(rows[i : i + size]).execute()


def _parse_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    text = str(value).replace(",", "").replace("₹", "").strip()
    if not text:
        return Decimal("0")
    try:
        return Decimal(text)
    except InvalidOperation:
        return Decimal("0")


def _infer_amount_triplet(dr_text: Any, cr_text: Any, bal_text: Any, raw_text: str) -> Tuple[Decimal, Decimal, Optional[Decimal]]:
    dr = _parse_decimal(dr_text)
    cr = _parse_decimal(cr_text)
    bal = _parse_decimal(bal_text) if bal_text not in (None, "") else None
    if dr or cr or bal is not None:
        return dr, cr, bal

    nums = [_parse_decimal(n) for n in AMOUNT_RE.findall(raw_text or "")]
    nums = [n for n in nums if n is not None]
    if not nums:
        return Decimal("0"), Decimal("0"), None
    if len(nums) == 1:
        return Decimal("0"), Decimal("0"), nums[0]
    if len(nums) == 2:
        return nums[0], Decimal("0"), nums[1]
    return nums[-3], nums[-2], nums[-1]


def _parse_date(value: str) -> Optional[dt.date]:
    if not value:
        return None
    try:
        return date_parser.parse(value, dayfirst=True).date()
    except Exception:
        return None


def _month_key(value: dt.date) -> str:
    return value.strftime("%Y-%m")


def _month_label(value: dt.date) -> str:
    return value.strftime("%b-%Y").upper()


def _classify_txn(narration: str, dr: Decimal, cr: Decimal) -> str:
    text = (narration or "").upper()
    if any(k in text for k in ["RETURN", "RTN", "BOUNCE"]):
        return "RETURN"
    if any(k in text for k in ["EMI", "LOAN", "INTEREST", "OD INTEREST", "BANK CHARGES"]):
        return "BANK FIN"
    if any(k in text for k in ["PVT", "PRIVATE", "HAND LOAN"]):
        return "PVT FIN"
    amount = max(abs(dr), abs(cr))
    if amount >= Decimal("1000000") and (amount % 1000) != 0:
        return "ODD FIG"
    if "DOUBT" in text:
        return "DOUBT"
    if dr > 0 and cr > 0:
        return "CONS"
    return "FINAL"


def _txn_type(dr: Decimal, cr: Decimal) -> str:
    if cr > 0 and dr <= 0:
        return "CREDIT"
    if dr > 0 and cr <= 0:
        return "DEBIT"
    if dr > 0 and cr > 0:
        return "MIXED"
    return "UNKNOWN"


def _hash_uid(parts: Iterable[Any]) -> str:
    source = "|".join(str(p) for p in parts)
    return hashlib.sha1(source.encode("utf-8")).hexdigest()


def _build_monthly_aggregates(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["month_key"]].append(row)

    aggregates = []
    for month, txns in sorted(grouped.items()):
        credit_total = sum(Decimal(str(t["cr"])) for t in txns)
        debit_total = sum(Decimal(str(t["dr"])) for t in txns)
        aggregates.append(
            {
                "month_key": month,
                "kpis": {
                    "txn_count": len(txns),
                    "credit_total": float(credit_total),
                    "debit_total": float(debit_total),
                    "net_flow": float(credit_total - debit_total),
                },
            }
        )
    return aggregates


def _build_pivot_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for row in rows:
        key = (row["month_key"], row.get("category") or "", row.get("txn_type") or "")
        if key not in grouped:
            grouped[key] = {
                "month_key": key[0],
                "category": key[1],
                "txn_type": key[2],
                "sum_dr": Decimal("0"),
                "sum_cr": Decimal("0"),
                "count_dr": 0,
                "count_cr": 0,
            }
        bucket = grouped[key]
        dr = Decimal(str(row["dr"]))
        cr = Decimal(str(row["cr"]))
        bucket["sum_dr"] += dr
        bucket["sum_cr"] += cr
        if dr > 0:
            bucket["count_dr"] += 1
        if cr > 0:
            bucket["count_cr"] += 1

    out = []
    for key in sorted(grouped.keys()):
        bucket = grouped[key]
        out.append(
            {
                "month_key": bucket["month_key"],
                "category": bucket["category"],
                "txn_type": bucket["txn_type"],
                "sum_dr": float(bucket["sum_dr"]),
                "sum_cr": float(bucket["sum_cr"]),
                "count_dr": bucket["count_dr"],
                "count_cr": bucket["count_cr"],
            }
        )
    return out


def _continuity_failures(rows: List[Dict[str, Any]]) -> int:
    ordered = [r for r in rows if r.get("balance") is not None]
    ordered.sort(key=lambda r: (r["txn_date"], r["transaction_uid"]))
    failures = 0
    prev_balance: Optional[Decimal] = None
    for row in ordered:
        balance = Decimal(str(row["balance"])) if row.get("balance") is not None else None
        if balance is None:
            continue
        if prev_balance is not None:
            expected = prev_balance + Decimal(str(row["cr"])) - Decimal(str(row["dr"]))
            if abs(balance - expected) > Decimal("0.01"):
                failures += 1
        prev_balance = balance
    return failures


def _choose_template_sheets(template_path: str) -> Tuple[List[str], List[str]]:
    wb = load_workbook(template_path, read_only=True)
    sheet_names = wb.sheetnames
    wb.close()
    xns_templates = [s for s in sheet_names if s.upper().startswith("XNS-")]
    pivot_templates = [s for s in sheet_names if s.upper().startswith("PIVOT-")]
    if not xns_templates:
        raise ValueError("No XNS-* template sheet found in workbook")
    if not pivot_templates:
        raise ValueError("No PIVOT-* template sheet found in workbook")
    return xns_templates, pivot_templates


def _upsert_storage_file(path: str, local_file_path: str, content_type: str) -> None:
    bucket = sb.storage.from_(settings.bucket)
    try:
        bucket.remove([path])
    except Exception:
        pass
    with open(local_file_path, "rb") as f:
        bucket.upload(path, f, {"content-type": content_type, "upsert": "true"})


@app.get("/health")
def health() -> Dict[str, Any]:
    template_exists = Path(settings.template_path).exists()
    return {
        "ok": True,
        "template_path": settings.template_path,
        "template_exists": template_exists,
        "bucket": settings.bucket,
    }


@app.post("/jobs/parse_statement/{version_id}")
def parse_statement(version_id: str) -> Dict[str, Any]:
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        sb.table("statement_versions").update({"status": "PARSING", "run_at": now_iso}).eq("id", version_id).execute()

        # Clear previous parse artifacts to keep reruns deterministic.
        for table in ["raw_statement_lines", "transactions", "aggregates_monthly", "pivots"]:
            try:
                sb.table(table).delete().eq("version_id", version_id).execute()
            except Exception:
                # Ignore if table/row does not exist in older migrations.
                pass

        pdf_resp = sb.table("pdf_files").select("*").eq("version_id", version_id).order("created_at").execute()
        pdfs = pdf_resp.data or []
        if not pdfs:
            raise HTTPException(status_code=404, detail="No PDFs found for this version")

        tmp_dir = tempfile.mkdtemp(prefix=f"stmt_{version_id}_")

        raw_lines_all: List[Tuple[Dict[str, Any], List[Any], List[Dict[str, Any]]]] = []
        all_raw_insert_rows: List[Dict[str, Any]] = []

        for pdf in pdfs:
            storage_path = pdf.get("storage_path")
            if not storage_path:
                raise HTTPException(status_code=400, detail=f"PDF {pdf.get('id')} missing storage_path")

            binary = sb.storage.from_(settings.bucket).download(storage_path)
            local_pdf = os.path.join(tmp_dir, f"{pdf['id']}.pdf")
            with open(local_pdf, "wb") as f:
                f.write(binary)

            raw_lines = extract_raw_lines_pdfplumber(local_pdf)
            raw_insert_rows: List[Dict[str, Any]] = []
            for line in raw_lines:
                raw_id = str(uuid.uuid4())
                row = {
                    "id": raw_id,
                    "version_id": version_id,
                    "pdf_file_id": pdf["id"],
                    "page_no": line.page_no,
                    "row_no": line.row_no,
                    "raw_row_text": line.raw_row_text,
                    "raw_date_text": line.date_text,
                    "raw_narration_text": line.narration_text,
                    "raw_dr_text": line.dr_text,
                    "raw_cr_text": line.cr_text,
                    "raw_balance_text": line.bal_text,
                    "line_type": line.line_type,
                    "extraction_method": line.extraction_method,
                    "bbox_json": None,
                }
                raw_insert_rows.append(row)
                all_raw_insert_rows.append(row)

            raw_lines_all.append((pdf, raw_lines, raw_insert_rows))

        _batch_insert("raw_statement_lines", all_raw_insert_rows, size=1000)

        mapped_indices_by_pdf: Dict[str, Set[int]] = defaultdict(set)
        transactions_to_insert: List[Dict[str, Any]] = []
        excel_txns_by_pdf: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for pdf, raw_lines, inserted_rows in raw_lines_all:
            merged = merge_multiline_transactions(raw_lines)
            for merged_row in merged:
                txn_date = _parse_date(merged_row.get("date_text", ""))
                if txn_date is None:
                    continue

                raw_indices = merged_row["raw_indices"]
                raw_ids = [inserted_rows[i]["id"] for i in raw_indices if 0 <= i < len(inserted_rows)]
                if not raw_ids:
                    continue

                for index in raw_indices:
                    mapped_indices_by_pdf[pdf["id"]].add(index)

                narration = (merged_row.get("narration") or "").strip()
                dr, cr, bal = _infer_amount_triplet(
                    merged_row.get("dr_text"),
                    merged_row.get("cr_text"),
                    merged_row.get("bal_text"),
                    narration,
                )
                category = _classify_txn(narration, dr, cr)
                txn_type = _txn_type(dr, cr)

                transaction_uid = _hash_uid(
                    [
                        version_id,
                        pdf["id"],
                        txn_date.isoformat(),
                        str(dr),
                        str(cr),
                        str(bal) if bal is not None else "",
                        narration,
                        ",".join(raw_ids),
                    ]
                )

                transaction_row = {
                    "id": str(uuid.uuid4()),
                    "version_id": version_id,
                    "raw_line_ids": raw_ids,
                    "txn_date": txn_date.isoformat(),
                    "month_key": _month_key(txn_date),
                    "narration": narration,
                    "dr": float(dr),
                    "cr": float(cr),
                    "balance": float(bal) if bal is not None else None,
                    "counterparty_norm": None,
                    "txn_type": txn_type,
                    "category": category,
                    "flags": [],
                    "transaction_uid": transaction_uid,
                }
                transactions_to_insert.append(transaction_row)

                excel_txns_by_pdf[pdf["id"]].append(
                    {
                        "date": txn_date,
                        "month_label": _month_label(txn_date),
                        "txn_type": txn_type,
                        "ref_no": "",
                        "category": category,
                        "narration": narration,
                        "dr": float(dr),
                        "cr": float(cr),
                        "balance": float(bal) if bal is not None else 0.0,
                    }
                )

        unmapped_total = 0
        for pdf, raw_lines, _ in raw_lines_all:
            unmapped_total += reconcile_strict(raw_lines, mapped_indices_by_pdf[pdf["id"]])

        if unmapped_total > 0:
            sb.table("statement_versions").update(
                {
                    "status": "PARSE_FAILED",
                    "unmapped_txn_lines": unmapped_total,
                    "run_at": now_iso,
                }
            ).eq("id", version_id).execute()
            return {"status": "PARSE_FAILED", "unmapped": unmapped_total}

        _batch_insert("transactions", transactions_to_insert, size=500)

        monthly_aggregates = _build_monthly_aggregates(transactions_to_insert)
        _batch_insert(
            "aggregates_monthly",
            [
                {
                    "id": str(uuid.uuid4()),
                    "version_id": version_id,
                    "month_key": agg["month_key"],
                    "kpis": agg["kpis"],
                }
                for agg in monthly_aggregates
            ],
            size=200,
        )

        pivot_rows = _build_pivot_rows(transactions_to_insert)
        _batch_insert(
            "pivots",
            [
                {
                    "id": str(uuid.uuid4()),
                    "version_id": version_id,
                    "month_key": p["month_key"],
                    "category": p["category"],
                    "txn_type": p["txn_type"],
                    "sum_dr": p["sum_dr"],
                    "sum_cr": p["sum_cr"],
                    "count_dr": p["count_dr"],
                    "count_cr": p["count_cr"],
                }
                for p in pivot_rows
            ],
            size=500,
        )

        continuity_failures = _continuity_failures(transactions_to_insert)

        xns_templates, pivot_templates = _choose_template_sheets(settings.template_path)
        accounts = []
        for index, pdf in enumerate(pdfs):
            txns = excel_txns_by_pdf.get(pdf["id"], [])
            xns_tpl = xns_templates[min(index, len(xns_templates) - 1)]
            piv_tpl = pivot_templates[min(index, len(pivot_templates) - 1)]
            accounts.append(
                {
                    "xns_template_sheet": xns_tpl,
                    "pivot_template_sheet": piv_tpl,
                    "xns_sheet_name": f"XNS-AUTO-{index + 1}",
                    "pivot_sheet_name": f"PIVOT-AUTO-{index + 1}",
                    "xns_start_row": 10,
                    "xns_template_row": 10,
                    "pivot_start_row": 2,
                    "pivot_template_row": 2,
                    "txns": txns,
                    "pivots": [p for p in pivot_rows],
                }
            )

        out_xlsx = os.path.join(tmp_dir, "perfios_output.xlsx")
        generate_perfios_excel(
            template_path=settings.template_path,
            output_path=out_xlsx,
            context={
                "accounts": accounts,
                "analysis_rows": [],
            },
        )

        export_path = f"exports/{version_id}/perfios_output.xlsx"
        _upsert_storage_file(
            export_path,
            out_xlsx,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        sb.table("statement_versions").update(
            {
                "status": "READY",
                "excel_url": export_path,
                "unmapped_txn_lines": 0,
                "continuity_failures": continuity_failures,
                "run_at": now_iso,
            }
        ).eq("id", version_id).execute()

        sb.table("audit_events").insert(
            {
                "id": str(uuid.uuid4()),
                "entity_type": "statement_version",
                "entity_id": version_id,
                "action": "PARSE_READY",
                "actor_user_id": None,
                "payload": {
                    "pdf_count": len(pdfs),
                    "transactions": len(transactions_to_insert),
                    "continuity_failures": continuity_failures,
                    "excel_url": export_path,
                },
            }
        ).execute()

        return {
            "status": "READY",
            "excel_path": export_path,
            "transactions": len(transactions_to_insert),
            "continuity_failures": continuity_failures,
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        try:
            sb.table("statement_versions").update(
                {
                    "status": "PARSE_FAILED",
                    "run_at": now_iso,
                }
            ).eq("id", version_id).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"parse_statement failed: {exc}") from exc
