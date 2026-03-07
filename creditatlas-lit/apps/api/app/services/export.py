from __future__ import annotations

import io
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from xml.sax.saxutils import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BankTransactionNormalized,
    Borrower,
    Counterparty,
    CreditBrainResult,
    EmiObligation,
    GstProfile,
    LoanCase,
    PrivateLenderSignal,
    RiskFlag,
    TruthEngineResult,
)


class ExportBuildError(Exception):
    pass


def build_case_export_payload(db: Session, *, org_id: str, case_id: str) -> dict:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == org_id))
    if not case:
        raise ExportBuildError("Case not found")

    borrower = db.scalar(
        select(Borrower).where(Borrower.id == case.borrower_id, Borrower.org_id == org_id)
    )
    if not borrower:
        raise ExportBuildError("Borrower not found")

    brain = db.scalar(select(CreditBrainResult).where(CreditBrainResult.case_id == case_id))
    truth_rows = db.scalars(
        select(TruthEngineResult)
        .where(TruthEngineResult.case_id == case_id)
        .order_by(TruthEngineResult.period_month.asc())
    ).all()
    emi_rows = db.scalars(select(EmiObligation).where(EmiObligation.case_id == case_id)).all()
    lender_rows = db.scalars(
        select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)
    ).all()
    risk_flags = db.scalars(select(RiskFlag).where(RiskFlag.case_id == case_id)).all()
    counterparties = db.scalars(select(Counterparty).where(Counterparty.case_id == case_id)).all()
    gst_profile = db.scalar(select(GstProfile).where(GstProfile.case_id == case_id))
    txns = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .order_by(BankTransactionNormalized.txn_date.asc())
    ).all()

    monthly_summary = _monthly_summary(txns)
    top_customers = sorted(counterparties, key=lambda x: float(x.total_credits), reverse=True)[:10]
    top_suppliers = sorted(counterparties, key=lambda x: float(x.total_debits), reverse=True)[:10]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "case": {
            "id": case.id,
            "status": case.status,
            "months_analyzed": case.months_analyzed,
            "accounts_analyzed": case.accounts_analyzed,
            "decision_badge": case.decision_badge,
            "created_at": case.created_at.isoformat() if case.created_at else None,
        },
        "borrower": {
            "id": borrower.id,
            "name": borrower.name,
            "industry": borrower.industry,
            "constitution": borrower.constitution,
            "gstin": borrower.gstin,
            "pan": borrower.pan,
        },
        "credit_brain": _credit_brain_payload(brain),
        "truth_engine": [
            {
                "period_month": row.period_month,
                "gross_credits": _num(row.gross_credits),
                "internal_transfers_excluded": _num(row.internal_transfers_excluded),
                "finance_credits_excluded": _num(row.finance_credits_excluded),
                "other_non_business_excluded": _num(row.other_non_business_excluded),
                "adjusted_business_credits": _num(row.adjusted_business_credits),
                "truth_confidence": _num(row.truth_confidence),
            }
            for row in truth_rows
        ],
        "emi_tracker": [
            {
                "lender_name": row.lender_name,
                "monthly_amount_estimate": _num(row.monthly_amount_estimate),
                "first_seen": row.first_seen.isoformat(),
                "last_seen": row.last_seen.isoformat(),
                "expected_day_of_month": row.expected_day_of_month,
                "delay_days_by_month": row.delay_days_by_month,
                "missed_months": row.missed_months,
                "confidence": _num(row.confidence),
            }
            for row in emi_rows
        ],
        "street_lender_intelligence": [
            {
                "lender_name": row.lender_name,
                "confidence": _num(row.confidence),
                "avg_credit_size": _num(row.avg_credit_size),
                "avg_repayment_size": _num(row.avg_repayment_size),
                "avg_cycle_days": _num(row.avg_cycle_days),
                "estimated_principal": _num(row.estimated_principal),
                "estimated_monthly_interest_burden": _num(row.estimated_monthly_interest_burden),
                "pattern_type": row.pattern_type,
            }
            for row in lender_rows
        ],
        "risk_flags": [
            {
                "code": row.code,
                "severity": row.severity,
                "title": row.title,
                "description": row.description,
                "metric_value": _num(row.metric_value),
            }
            for row in risk_flags
        ],
        "counterparties": {
            "top_customers": [
                {
                    "name": row.canonical_name,
                    "total_credits": _num(row.total_credits),
                    "txn_count": row.txn_count,
                }
                for row in top_customers
            ],
            "top_suppliers": [
                {
                    "name": row.canonical_name,
                    "total_debits": _num(row.total_debits),
                    "txn_count": row.txn_count,
                }
                for row in top_suppliers
            ],
        },
        "monthly_summary": monthly_summary,
        "transactions": [
            {
                "id": row.id,
                "txn_date": row.txn_date.isoformat(),
                "amount": _num(row.amount),
                "direction": row.direction,
                "counterparty_name": row.counterparty_name,
                "narration_clean": row.narration_clean,
                "category_internal": row.category_internal,
                "source_vendor": row.source_vendor,
            }
            for row in txns
        ],
        "gst_profile": _gst_payload(gst_profile),
    }
    return payload


def render_case_pdf(payload: dict) -> bytes:
    borrower = payload.get("borrower", {})
    case = payload.get("case", {})
    brain = payload.get("credit_brain") or {}

    lines = [
        "CreditAtlas LIT - Case Export",
        f"Case ID: {case.get('id', '-')}",
        f"Borrower: {borrower.get('name', '-')}",
        f"Industry: {borrower.get('industry', '-')}",
        f"Constitution: {borrower.get('constitution', '-')}",
        f"Decision: {brain.get('decision', case.get('decision_badge', 'PENDING'))}",
        f"Grade: {brain.get('grade', '-')}",
        f"Truth Score: {brain.get('truth_score', '-')}",
        f"Stress Score: {brain.get('stress_score', '-')}",
        f"Fraud Score: {brain.get('fraud_score', '-')}",
        "",
        f"Generated At: {payload.get('generated_at', '-')}",
    ]
    return _build_simple_pdf(lines)


def render_case_excel(payload: dict) -> bytes:
    summary_rows = [
        ["Field", "Value"],
        ["Case ID", payload["case"]["id"]],
        ["Borrower", payload["borrower"]["name"]],
        ["Industry", payload["borrower"].get("industry") or ""],
        ["Constitution", payload["borrower"].get("constitution") or ""],
        ["Decision", (payload.get("credit_brain") or {}).get("decision") or payload["case"].get("decision_badge")],
        ["Grade", (payload.get("credit_brain") or {}).get("grade") or ""],
        ["Truth Score", (payload.get("credit_brain") or {}).get("truth_score") or ""],
        ["Stress Score", (payload.get("credit_brain") or {}).get("stress_score") or ""],
        ["Fraud Score", (payload.get("credit_brain") or {}).get("fraud_score") or ""],
        ["Generated At", payload.get("generated_at")],
    ]

    txn_rows = [["Txn Date", "Direction", "Amount", "Counterparty", "Category", "Narration"]]
    for row in payload.get("transactions", []):
        txn_rows.append(
            [
                row.get("txn_date"),
                row.get("direction"),
                row.get("amount"),
                row.get("counterparty_name") or "",
                row.get("category_internal") or "",
                row.get("narration_clean") or "",
            ]
        )

    return _build_minimal_xlsx({"Summary": summary_rows, "Transactions": txn_rows})


def _credit_brain_payload(brain: CreditBrainResult | None) -> dict | None:
    if not brain:
        return None
    return {
        "decision": brain.decision,
        "grade": brain.grade,
        "truth_score": _num(brain.truth_score),
        "stress_score": _num(brain.stress_score),
        "fraud_score": _num(brain.fraud_score),
        "suggested_exposure_min": _num(brain.suggested_exposure_min),
        "suggested_exposure_max": _num(brain.suggested_exposure_max),
        "key_positives": brain.key_positives,
        "key_concerns": brain.key_concerns,
        "conditions_precedent": brain.conditions_precedent,
        "narrative": brain.narrative,
    }


def _gst_payload(profile: GstProfile | None) -> dict | None:
    if not profile:
        return None
    return {
        "provider_name": profile.provider_name,
        "gstin": profile.gstin,
        "legal_name": profile.legal_name,
        "registration_status": profile.registration_status,
        "filing_frequency": profile.filing_frequency,
        "last_filed_period": profile.last_filed_period,
        "gstr1_turnover": _num(profile.gstr1_turnover),
        "gstr3b_turnover": _num(profile.gstr3b_turnover),
        "confidence": _num(profile.confidence),
    }


def _monthly_summary(txns: list[BankTransactionNormalized]) -> list[dict]:
    rollup = defaultdict(lambda: {"credits": 0.0, "debits": 0.0})
    for row in txns:
        month = row.txn_date.strftime("%Y-%m")
        amount = float(row.amount)
        if row.direction == "CREDIT":
            rollup[month]["credits"] += amount
        else:
            rollup[month]["debits"] += amount

    return [
        {
            "month": month,
            "credits": round(values["credits"], 2),
            "debits": round(values["debits"], 2),
            "net": round(values["credits"] - values["debits"], 2),
        }
        for month, values in sorted(rollup.items())
    ]


def _num(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return float(value)


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: list[str]) -> bytes:
    y_start = 760
    line_height = 16
    content_parts = ["BT", "/F1 12 Tf", f"50 {y_start} Td"]
    for idx, line in enumerate(lines):
        if idx > 0:
            content_parts.append(f"0 -{line_height} Td")
        content_parts.append(f"({_pdf_escape(line)}) Tj")
    content_parts.append("ET")
    content = "\n".join(content_parts).encode("latin-1", errors="replace")

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream",
    ]

    buffer = io.BytesIO()
    buffer.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for i, obj in enumerate(objs, start=1):
        offsets.append(buffer.tell())
        buffer.write(f"{i} 0 obj\n".encode())
        buffer.write(obj)
        buffer.write(b"\nendobj\n")

    xref_pos = buffer.tell()
    buffer.write(f"xref\n0 {len(objs) + 1}\n".encode())
    buffer.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buffer.write(f"{off:010d} 00000 n \n".encode())

    buffer.write(
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return buffer.getvalue()


def _build_minimal_xlsx(sheets: dict[str, list[list[object]]]) -> bytes:
    workbook_sheets = []
    workbook_rels = []
    sheet_xml_files: dict[str, str] = {}

    for idx, (sheet_name, rows) in enumerate(sheets.items(), start=1):
        safe_name = sheet_name[:31]
        workbook_sheets.append(
            f'<sheet name="{escape(safe_name)}" sheetId="{idx}" r:id="rId{idx}"/>'
        )
        workbook_rels.append(
            f'<Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
        )
        sheet_xml_files[f"xl/worksheets/sheet{idx}.xml"] = _sheet_xml(rows)

    content_types = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    for idx in range(1, len(sheets) + 1):
        content_types.append(
            f'<Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    content_types.append("</Types>")

    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheets>{''.join(workbook_sheets)}</sheets>"
        "</workbook>"
    )

    workbook_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{''.join(workbook_rels)}"
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )

    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="1"><xf xfId="0"/></cellXfs>'
        '</styleSheet>'
    )

    root_rels_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )

    out = io.BytesIO()
    with zipfile.ZipFile(out, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "".join(content_types))
        zf.writestr("_rels/.rels", root_rels_xml)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml)
        zf.writestr("xl/styles.xml", styles_xml)
        for path, xml in sheet_xml_files.items():
            zf.writestr(path, xml)

    return out.getvalue()


def _sheet_xml(rows: list[list[object]]) -> str:
    row_xml_parts: list[str] = []
    for r_idx, row in enumerate(rows, start=1):
        cells = []
        for c_idx, value in enumerate(row, start=1):
            cell_ref = f"{_col_name(c_idx)}{r_idx}"
            if isinstance(value, (int, float, Decimal)) and value != "":
                cells.append(f'<c r="{cell_ref}"><v>{value}</v></c>')
            else:
                text = "" if value is None else escape(str(value))
                cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{text}</t></is></c>')
        row_xml_parts.append(f'<row r="{r_idx}">{"".join(cells)}</row>')

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml_parts)}</sheetData>'
        "</worksheet>"
    )


def _col_name(index: int) -> str:
    name = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name
