from __future__ import annotations

import argparse
import csv
import sqlite3
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def normalize_type_label(value: str) -> str:
    t = " ".join((value or "").upper().split()).strip()
    aliases = {
        "EXPENSES": "EXPENSE",
        "CASH WITHDRAWAL": "CASH",
        "CASH DEPOSIT": "CASH",
        "UNMATCH SIS CON": "SIS CON",
    }
    return aliases.get(t, t)


@dataclass
class ManualRow:
    account: str
    sl: int
    date: str
    typ: str
    dr: float
    cr: float
    bal: float | None
    desc: str


@dataclass
class ParsedRow:
    account: str
    txn_id: int
    date: str
    typ: str
    dr: float
    cr: float
    bal: float | None
    desc: str


BANK_ALIAS = {
    "KARB": "KVB",
    "KVB": "KVB",
}


def _col_idx(ref: str) -> int:
    col = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def _parse_date(value: str) -> str:
    s = (value or "").strip()
    if not s:
        return ""
    # Excel serial date from sheet XML numeric cells.
    if s.replace(".", "", 1).isdigit():
        try:
            serial = float(s)
            # Excel date system baseline for Windows workbooks.
            base = datetime(1899, 12, 30)
            return (base + timedelta(days=serial)).date().isoformat()
        except Exception:
            pass
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    return s


def _to_float(text: str, default: float = 0.0) -> float:
    t = (text or "").strip().replace(",", "")
    if not t:
        return default
    try:
        return float(t)
    except ValueError:
        return default


def _account_aliases_from_key(account_key: str) -> set[str]:
    # DB account key format: BANK-<last5>-TYPE
    parts = (account_key or "").split("-")
    if len(parts) < 3:
        return {account_key}
    bank = parts[0]
    mid = parts[1]
    typ = parts[2]
    aliases = {f"{bank}-{mid}-{typ}"}
    if len(mid) >= 4:
        aliases.add(f"{bank}-{mid[-4:]}-{typ}")
    if len(mid) >= 3:
        aliases.add(f"{bank}-{mid[-3:]}-{typ}")
    return aliases


def _account_canonical(account: str) -> str:
    parts = (account or "").split("-")
    if len(parts) < 3:
        return account
    bank = BANK_ALIAS.get(parts[0], parts[0])
    mid = parts[1]
    last4 = mid[-4:] if mid else mid
    return f"{bank}-{last4}"


def read_manual_xns(workbook: Path) -> list[ManualRow]:
    rows: list[ManualRow] = []
    with zipfile.ZipFile(workbook) as zf:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst.findall("a:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))

        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {r.attrib["Id"]: r.attrib["Target"] for r in rels}

        for sh in wb.find("a:sheets", NS):
            name = sh.attrib["name"]
            if not name.startswith("XNS-"):
                continue
            account = name.replace("XNS-", "")
            rid = sh.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            xml = ET.fromstring(zf.read("xl/" + rid_to_target[rid]))

            for row in xml.findall(".//a:sheetData/a:row", NS):
                vals: dict[int, str] = {}
                for c in row.findall("a:c", NS):
                    idx = _col_idx(c.attrib.get("r", "A1"))
                    typ = c.attrib.get("t")
                    if typ == "s":
                        v = c.find("a:v", NS)
                        txt = shared[int(v.text)] if v is not None and v.text else ""
                    elif typ == "inlineStr":
                        te = c.find(".//a:t", NS)
                        txt = te.text if te is not None and te.text else ""
                    else:
                        v = c.find("a:v", NS)
                        txt = v.text if v is not None and v.text else ""
                    vals[idx] = txt

                sl = vals.get(1, "")
                if not sl.isdigit():
                    continue
                dt = _parse_date(vals.get(2, ""))
                typ = normalize_type_label(vals.get(4, ""))
                desc = (vals.get(7, "") or "").strip()
                dr = _to_float(vals.get(8, "0")) * 100000.0
                cr = _to_float(vals.get(9, "0")) * 100000.0
                bal_text = (vals.get(10, "") or "").strip()
                bal = _to_float(bal_text, default=0.0) if bal_text else None
                rows.append(
                    ManualRow(
                        account=account,
                        sl=int(sl),
                        date=dt,
                        typ=typ,
                        dr=round(dr, 2),
                        cr=round(cr, 2),
                        bal=round(bal, 2) if bal is not None else None,
                        desc=desc,
                    )
                )
    return rows


def read_parsed_rows(db_path: Path, job_id: str) -> list[ParsedRow]:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    out: list[ParsedRow] = []
    rows = cur.execute(
        """
        SELECT
          t.id AS txn_id,
          t.txn_date AS txn_date,
          UPPER(t.classification_primary) AS typ,
          t.debit AS dr,
          t.credit AS cr,
          t.balance AS bal,
          t.raw_narration AS desc,
          a.account_key AS account_key
        FROM transactions t
        LEFT JOIN accounts a ON a.id = t.account_id
        WHERE t.job_id = ?
        ORDER BY a.account_key, t.txn_order, t.id
        """,
        (job_id,),
    ).fetchall()

    for r in rows:
        acc = r["account_key"] or "GENERIC-UNKNOWN-NA"
        aliases = _account_aliases_from_key(acc)
        account = sorted(aliases, key=len)[0]
        out.append(
            ParsedRow(
                account=account,
                txn_id=int(r["txn_id"]),
                date=(r["txn_date"] or ""),
                typ=normalize_type_label((r["typ"] or "UNKNOWN").strip().upper()),
                dr=round(float(r["dr"] or 0.0), 2),
                cr=round(float(r["cr"] or 0.0), 2),
                bal=round(float(r["bal"]), 2) if r["bal"] is not None else None,
                desc=(r["desc"] or "").strip(),
            )
        )
    con.close()
    return out


def _key_date_amt_bal(date: str, dr: float, cr: float, bal: float | None) -> tuple:
    return (date, round(dr, 2), round(cr, 2), None if bal is None else round(bal, 2))


def _key_date_amt(date: str, dr: float, cr: float) -> tuple:
    return (date, round(dr, 2), round(cr, 2))


def verify(manual_rows: list[ManualRow], parsed_rows: list[ParsedRow]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    details: list[dict[str, str]] = []
    summaries: list[dict[str, str]] = []

    m_by_acc: dict[str, list[ManualRow]] = defaultdict(list)
    for r in manual_rows:
        m_by_acc[_account_canonical(r.account)].append(r)

    p_by_acc: dict[str, list[ParsedRow]] = defaultdict(list)
    for r in parsed_rows:
        p_by_acc[_account_canonical(r.account)].append(r)

    # account alignment via suffix match (TMB-5048-CA to TMB-75048-CA)
    aligned: dict[str, str] = {}
    parsed_accounts = list(p_by_acc.keys())
    for m_acc in m_by_acc:
        match = None
        if m_acc in p_by_acc:
            match = m_acc
        else:
            for p_acc in parsed_accounts:
                if p_acc.endswith(m_acc.split("-", 1)[-1]) or m_acc.endswith(p_acc.split("-", 1)[-1]):
                    match = p_acc
                    break
            if match is None:
                m_parts = m_acc.split("-")
                if len(m_parts) >= 3:
                    m_bank, m_mid, m_type = m_parts[0], m_parts[1], m_parts[2]
                    for p_acc in parsed_accounts:
                        p_parts = p_acc.split("-")
                        if len(p_parts) < 3:
                            continue
                        p_bank, p_mid, p_type = p_parts[0], p_parts[1], p_parts[2]
                        if m_bank == p_bank and (p_mid.endswith(m_mid) or m_mid.endswith(p_mid)):
                            match = p_acc
                            break
        if match:
            aligned[m_acc] = match

    for m_acc, m_rows in m_by_acc.items():
        p_acc = aligned.get(m_acc, m_acc)
        p_rows = p_by_acc.get(p_acc, [])

        used: set[int] = set()
        by_k4: dict[tuple, list[int]] = defaultdict(list)
        by_k3: dict[tuple, list[int]] = defaultdict(list)
        for i, p in enumerate(p_rows):
            by_k4[_key_date_amt_bal(p.date, p.dr, p.cr, p.bal)].append(i)
            by_k3[_key_date_amt(p.date, p.dr, p.cr)].append(i)

        matched = 0
        type_matched = 0
        for m in m_rows:
            idx = None
            status = "MANUAL_ONLY"
            k4 = _key_date_amt_bal(m.date, m.dr, m.cr, m.bal)
            for cand in by_k4.get(k4, []):
                if cand not in used:
                    idx = cand
                    status = "EXACT"
                    break
            if idx is None:
                k3 = _key_date_amt(m.date, m.dr, m.cr)
                for cand in by_k3.get(k3, []):
                    if cand not in used:
                        idx = cand
                        status = "AMOUNT_DATE"
                        break

            if idx is None:
                details.append(
                    {
                        "account": m_acc,
                        "status": status,
                        "manual_sl": str(m.sl),
                        "manual_date": m.date,
                        "manual_type": m.typ,
                        "manual_dr": f"{m.dr:.2f}",
                        "manual_cr": f"{m.cr:.2f}",
                        "manual_bal": "" if m.bal is None else f"{m.bal:.2f}",
                        "manual_desc": m.desc,
                        "parsed_id": "",
                        "parsed_date": "",
                        "parsed_type": "",
                        "parsed_dr": "",
                        "parsed_cr": "",
                        "parsed_bal": "",
                        "parsed_desc": "",
                        "type_match": "0",
                    }
                )
                continue

            used.add(idx)
            p = p_rows[idx]
            matched += 1
            tmatch = int(m.typ == p.typ)
            type_matched += tmatch
            details.append(
                {
                    "account": m_acc,
                    "status": status,
                    "manual_sl": str(m.sl),
                    "manual_date": m.date,
                    "manual_type": m.typ,
                    "manual_dr": f"{m.dr:.2f}",
                    "manual_cr": f"{m.cr:.2f}",
                    "manual_bal": "" if m.bal is None else f"{m.bal:.2f}",
                    "manual_desc": m.desc,
                    "parsed_id": str(p.txn_id),
                    "parsed_date": p.date,
                    "parsed_type": p.typ,
                    "parsed_dr": f"{p.dr:.2f}",
                    "parsed_cr": f"{p.cr:.2f}",
                    "parsed_bal": "" if p.bal is None else f"{p.bal:.2f}",
                    "parsed_desc": p.desc,
                    "type_match": str(tmatch),
                }
            )

        parsed_only = 0
        for i, p in enumerate(p_rows):
            if i in used:
                continue
            parsed_only += 1
            details.append(
                {
                    "account": m_acc,
                    "status": "PARSED_ONLY",
                    "manual_sl": "",
                    "manual_date": "",
                    "manual_type": "",
                    "manual_dr": "",
                    "manual_cr": "",
                    "manual_bal": "",
                    "manual_desc": "",
                    "parsed_id": str(p.txn_id),
                    "parsed_date": p.date,
                    "parsed_type": p.typ,
                    "parsed_dr": f"{p.dr:.2f}",
                    "parsed_cr": f"{p.cr:.2f}",
                    "parsed_bal": "" if p.bal is None else f"{p.bal:.2f}",
                    "parsed_desc": p.desc,
                    "type_match": "0",
                }
            )

        manual_count = len(m_rows)
        parsed_count = len(p_rows)
        match_pct = (matched / manual_count * 100.0) if manual_count else 0.0
        type_match_pct = (type_matched / matched * 100.0) if matched else 0.0
        summaries.append(
            {
                "account": m_acc,
                "manual_rows": str(manual_count),
                "parsed_rows": str(parsed_count),
                "matched_rows": str(matched),
                "match_pct": f"{match_pct:.2f}",
                "type_match_pct": f"{type_match_pct:.2f}",
                "manual_only": str(manual_count - matched),
                "parsed_only": str(parsed_only),
            }
        )

    return summaries, details


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify parsed transaction types against manual XNS workbook")
    parser.add_argument("--workbook", required=True, help="Manual working workbook (.xlsx)")
    parser.add_argument("--db", default="bank_intel.db", help="SQLite DB path")
    parser.add_argument("--job-id", required=True, help="Job ID to verify")
    parser.add_argument("--out-prefix", default="out/verification", help="Output prefix for summary/detail CSV")
    args = parser.parse_args()

    manual = read_manual_xns(Path(args.workbook))
    parsed = read_parsed_rows(Path(args.db), args.job_id)
    summaries, details = verify(manual, parsed)

    summary_path = Path(f"{args.out_prefix}_summary.csv")
    detail_path = Path(f"{args.out_prefix}_detail.csv")
    write_csv(summary_path, summaries)
    write_csv(detail_path, details)

    for row in summaries:
        print(
            f"{row['account']}: match={row['match_pct']}% type_match={row['type_match_pct']}% "
            f"manual_only={row['manual_only']} parsed_only={row['parsed_only']}"
        )
    print(f"wrote {summary_path}")
    print(f"wrote {detail_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
