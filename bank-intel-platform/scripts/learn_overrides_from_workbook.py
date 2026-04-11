from __future__ import annotations

import argparse
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import yaml

from app.classification.signature import normalize_type_label, signature_keys

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def _col_idx(ref: str) -> int:
    col = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def learn(workbook_path: Path, min_count: int = 1) -> dict:
    by_bank: dict[str, Counter[tuple[str, str]]] = defaultdict(Counter)
    global_ctr: Counter[tuple[str, str]] = Counter()

    with zipfile.ZipFile(workbook_path) as zf:
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
            parts = name.replace("XNS-", "").split("-")
            bank = parts[0].upper() if parts else "GENERIC"
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
                if not str(sl).isdigit():
                    continue
                cls = normalize_type_label(vals.get(4, ""))
                desc = vals.get(7, "")
                if not cls or not desc:
                    continue
                try:
                    dr = float(vals.get(8, "0") or 0) * 100000.0
                except Exception:
                    dr = 0.0
                try:
                    cr = float(vals.get(9, "0") or 0) * 100000.0
                except Exception:
                    cr = 0.0

                for key in signature_keys(desc, dr, cr):
                    by_bank[bank][(key, cls)] += 1
                    global_ctr[(key, cls)] += 1

    bank_scoped: dict[str, dict[str, str]] = {}
    for bank, ctr in by_bank.items():
        grouped: dict[str, Counter[str]] = defaultdict(Counter)
        for (sig, cls), c in ctr.items():
            grouped[sig][cls] += c
        bank_scoped[bank] = {
            sig: cls_counts.most_common(1)[0][0]
            for sig, cls_counts in grouped.items()
            if cls_counts.most_common(1)[0][1] >= min_count
        }

    grouped_g: dict[str, Counter[str]] = defaultdict(Counter)
    for (sig, cls), c in global_ctr.items():
        grouped_g[sig][cls] += c
    global_map = {
        sig: cls_counts.most_common(1)[0][0]
        for sig, cls_counts in grouped_g.items()
        if cls_counts.most_common(1)[0][1] >= min_count
    }

    return {
        "manual_overrides": {
            "enabled": True,
            "global": global_map,
            "bank_scoped": bank_scoped,
        }
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Learn narration-signature type overrides from working workbook")
    parser.add_argument("--workbook", required=True)
    parser.add_argument("--out", default="app/config/manual_overrides.yaml")
    parser.add_argument("--min-count", type=int, default=1)
    args = parser.parse_args()

    payload = learn(Path(args.workbook), min_count=args.min_count)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
    print(f"written={out} global={len(payload['manual_overrides']['global'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
