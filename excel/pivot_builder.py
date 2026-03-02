from __future__ import annotations

from collections import defaultdict

from core.amount_date_parsers import amount_to_lakhs
from core.canonical_models import CanonicalTransaction, TYPE_CODES


def _month_sort_key(label: str) -> tuple[int, str]:
    m = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
    return m.get(label[:3].upper(), 99), label


def build_pivot_table(txns: list[CanonicalTransaction]) -> dict[str, object]:
    months = sorted({t.month_label for t in txns}, key=_month_sort_key)

    bucket: dict[tuple[str, str], dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: {"DR": 0.0, "CR": 0.0}))
    for t in txns:
        bucket[(t.type_code, t.category_clean)][t.month_label]["DR"] += t.dr_amount
        bucket[(t.type_code, t.category_clean)][t.month_label]["CR"] += t.cr_amount

    rows: list[dict[str, object]] = []
    grand_dr = 0.0
    grand_cr = 0.0

    for type_code in TYPE_CODES:
        type_rows = []
        type_dr = 0.0
        type_cr = 0.0
        cats = sorted([k for k in bucket.keys() if k[0] == type_code], key=lambda x: x[1])
        for _type, cat in cats:
            row: dict[str, object] = {"TYPE": type_code, "CATEGORY": cat}
            total_dr = 0.0
            total_cr = 0.0
            for m in months:
                dr = bucket[(_type, cat)][m]["DR"]
                cr = bucket[(_type, cat)][m]["CR"]
                row[f"{m}_DR"] = amount_to_lakhs(dr)
                row[f"{m}_CR"] = amount_to_lakhs(cr)
                total_dr += dr
                total_cr += cr
            row["TOTAL_DR"] = amount_to_lakhs(total_dr)
            row["TOTAL_CR"] = amount_to_lakhs(total_cr)
            type_dr += total_dr
            type_cr += total_cr
            type_rows.append(row)

        subtotal = {"TYPE": type_code, "CATEGORY": "SUBTOTAL"}
        for m in months:
            mdr = sum(bucket[(t, c)][m]["DR"] for (t, c) in cats)
            mcr = sum(bucket[(t, c)][m]["CR"] for (t, c) in cats)
            subtotal[f"{m}_DR"] = amount_to_lakhs(mdr)
            subtotal[f"{m}_CR"] = amount_to_lakhs(mcr)
        subtotal["TOTAL_DR"] = amount_to_lakhs(type_dr)
        subtotal["TOTAL_CR"] = amount_to_lakhs(type_cr)

        rows.extend(type_rows)
        rows.append(subtotal)
        grand_dr += type_dr
        grand_cr += type_cr

    grand = {"TYPE": "GRAND TOTAL", "CATEGORY": ""}
    for m in months:
        mdr = sum(t.dr_amount for t in txns if t.month_label == m)
        mcr = sum(t.cr_amount for t in txns if t.month_label == m)
        grand[f"{m}_DR"] = amount_to_lakhs(mdr)
        grand[f"{m}_CR"] = amount_to_lakhs(mcr)
    grand["TOTAL_DR"] = amount_to_lakhs(grand_dr)
    grand["TOTAL_CR"] = amount_to_lakhs(grand_cr)

    columns = ["TYPE", "CATEGORY"]
    for m in months:
        columns.extend([f"{m}_DR", f"{m}_CR"])
    columns.extend(["TOTAL_DR", "TOTAL_CR"])

    return {
        "months": months,
        "columns": columns,
        "rows": rows,
        "grand": grand,
        "xns_total_dr": amount_to_lakhs(sum(t.dr_amount for t in txns)),
        "xns_total_cr": amount_to_lakhs(sum(t.cr_amount for t in txns)),
    }
