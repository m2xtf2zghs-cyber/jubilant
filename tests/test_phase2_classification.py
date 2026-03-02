from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from backend.cli_phase2 import load_config
from core.classification.classifier import classify_transactions
from core.canonical_models import CanonicalTransaction
from core.normalize import extract_party_name, normalize_narration


CFG = load_config("configs/default.yaml")


def _make_txn(idx: int, row: dict) -> CanonicalTransaction:
    narr_raw = row["narration_raw"]
    narr_norm = normalize_narration(narr_raw)
    dr = float(row.get("dr", 0.0))
    cr = float(row.get("cr", 0.0))

    y, m, d = [int(x) for x in row["txn_date"].split("-")]
    dt = date(y, m, d)
    party = extract_party_name(narr_norm, CFG) or "DOUBT"

    return CanonicalTransaction(
        txn_uid=f"t{idx}",
        source_file="fixture.json",
        source_page=1,
        source_line=idx,
        statement_order=idx,
        bank_name="TMB",
        account_holder="AFFAN METALS",
        account_no_masked="XXXXX5048",
        account_type=row.get("account_type", "CA"),
        account_id="TMB-5048-CA",
        txn_date=dt,
        month_label=dt.strftime("%b").upper(),
        narration_raw=narr_raw,
        narration_norm=narr_norm,
        cheque_no=None,
        ref_no=None,
        utr=None,
        dr_amount=dr,
        cr_amount=cr,
        balance=row.get("balance"),
        channel="OTHER",
        type_code="DOUBT",
        category_clean=party,
        rule_id="UNCLASSIFIED",
        confidence="LOW",
        matched_tokens=[],
        flags=[],
    )


def test_phase2_rule_fixtures():
    fixture_path = Path(__file__).parent / "fixtures" / "rows.json"
    rows = json.loads(fixture_path.read_text(encoding="utf-8"))
    txns = [_make_txn(i + 1, row) for i, row in enumerate(rows)]

    # context rows to trigger recurrence-based PVT FIN for ILAKKIA
    for extra_i, month in enumerate([4, 5, 6, 7], start=100):
        txns.append(
            CanonicalTransaction(
                txn_uid=f"bg{extra_i}",
                source_file="fixture.json",
                source_page=1,
                source_line=extra_i,
                statement_order=extra_i,
                bank_name="TMB",
                account_holder="AFFAN METALS",
                account_no_masked="XXXXX5048",
                account_type="CA",
                account_id="TMB-5048-CA",
                txn_date=date(2025, month, 10),
                month_label=date(2025, month, 10).strftime("%b").upper(),
                narration_raw="TR/CHEPA/ILAKKIA",
                narration_norm="TR/CHEPA/ILAKKIA",
                cheque_no=None,
                ref_no=None,
                utr=None,
                dr_amount=113000.0,
                cr_amount=0.0,
                balance=None,
                channel="INTERNAL",
                type_code="DOUBT",
                category_clean="ILAKKIA",
                rule_id="UNCLASSIFIED",
                confidence="LOW",
                matched_tokens=[],
                flags=[],
            )
        )

    account_entities = {"AFFAN METALS": "TMB-5048-CA", "VEERA INDUSTRIES": "TMB-0123-OD"}
    sister_entities = {"VEERA INDUSTRIES": "TMB-0123-OD"}

    classify_transactions(txns, config=CFG, account_entities=account_entities, sister_entities=sister_entities)

    by_name = {row["name"]: txn for row, txn in zip(rows, txns)}

    for row in rows:
        txn = by_name[row["name"]]
        assert txn.type_code == row["expect_type"], f"{row['name']} expected {row['expect_type']} got {txn.type_code}"
        if "expect_category" in row:
            assert txn.category_clean == row["expect_category"], f"{row['name']} category mismatch"
        if "expect_category_contains" in row:
            assert row["expect_category_contains"].upper() in txn.category_clean.upper(), f"{row['name']} contains mismatch"
        if "expect_rule_prefix" in row:
            assert txn.rule_id.startswith(row["expect_rule_prefix"]), f"{row['name']} rule mismatch {txn.rule_id}"
        if "expect_flags_include" in row:
            for fl in row["expect_flags_include"]:
                assert fl in txn.flags, f"{row['name']} missing flag {fl}"

    assert all(t.type_code for t in txns)
    assert all(t.category_clean for t in txns)
