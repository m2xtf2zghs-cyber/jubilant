from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from core.bank_adapter_registry import extract_statements
from core.canonical_models import CanonicalTransaction, ReconIssue, ReconSummary
from core.classification.classifier import classify_transactions
from core.metrics import account_recon, compute_analysis, compute_cons_by_month, compute_final_summary, compute_sis_con_mismatch
from core.normalize import raw_to_canonical
from core.overrides_store import apply_overrides, load_overrides, save_override
from core.underwriting_engine import apply_underwriting, build_account_context


def _deep_merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for k, v in extra.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _load_config_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml  # type: ignore

            data = yaml.safe_load(text) or {}
        except Exception:
            return {}
    if not isinstance(data, dict):
        return {}

    parent = path.parent
    extends = data.get("extends")
    if isinstance(extends, str):
        ext_path = Path(extends)
        if not ext_path.is_absolute():
            ext_path = (parent.parent / ext_path).resolve() if extends.startswith("configs/") else (parent / ext_path).resolve()
        base = _load_config_file(ext_path)
        data = _deep_merge(base, {k: v for k, v in data.items() if k != "extends"})

    return data


def load_config(config_path: str | None) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1]
    cfg = _load_config_file(root / "configs" / "default.yaml")
    cfg = _deep_merge(cfg, _load_config_file(root / "configs" / "bank_aliases.yaml"))
    if config_path:
        user_path = Path(config_path)
        if not user_path.is_absolute():
            user_path = (Path.cwd() / user_path).resolve()
        cfg = _deep_merge(cfg, _load_config_file(user_path))
    return cfg


def _build_account_entities(account_txns: dict[str, list[CanonicalTransaction]]) -> dict[str, str]:
    entities: dict[str, str] = {}
    for account_id, txns in account_txns.items():
        if not txns:
            continue
        holder = (txns[0].account_holder or "").upper().strip()
        if holder:
            entities[holder] = account_id
    return entities


def _build_sister_entities(config: dict[str, Any], account_entities: dict[str, str]) -> dict[str, str]:
    sister_entities: dict[str, str] = {}
    groups = config.get("sister_concerns", {}).get("known_groups", [])
    for group in groups:
        entity = str(group.get("entity", "")).upper().strip()
        aliases = [str(a).upper().strip() for a in group.get("aliases", [])]
        all_names = [entity] + aliases
        mapped = None
        for n in all_names:
            if n in account_entities:
                mapped = account_entities[n]
                break
        for n in all_names:
            if n:
                sister_entities[n] = mapped or entity
    return sister_entities


def run_phase2(inputs: list[str], out_path: str, config_path: str | None, overrides_db: str) -> int:
    from excel.writer_phase2 import write_phase2_workbook

    cfg = load_config(config_path)
    statements = []
    extraction_issues: list[ReconIssue] = []
    recon_summaries: list[ReconSummary] = []
    for path in inputs:
        try:
            statements.extend(extract_statements([path], config=cfg))
        except Exception as exc:
            extraction_issues.append(
                ReconIssue(
                    severity="FAIL",
                    code="EXTRACT_FAIL",
                    message=str(exc),
                    source_file=path,
                )
            )
            recon_summaries.append(
                ReconSummary(
                    account_id=f"UNKNOWN-{Path(path).stem[-4:]}",
                    source_file=path,
                    expected_rows=0,
                    parsed_rows=0,
                    total_dr=0.0,
                    total_cr=0.0,
                    balance_breaks=0,
                    date_failures=0,
                    status="FAIL",
                    notes="Extraction failed before parsing rows.",
                )
            )

    bundles = [raw_to_canonical(stmt, cfg) for stmt in statements]

    # merge by account id if multiple files of same account
    account_txns: dict[str, list[CanonicalTransaction]] = defaultdict(list)
    expected_rows_by_account: dict[str, int] = defaultdict(int)
    source_file_by_account: dict[str, str] = {}
    for stmt, bundle in zip(statements, bundles):
        account_txns[bundle.account_id].extend(bundle.transactions)
        expected_rows_by_account[bundle.account_id] += len(stmt.rows)
        source_file_by_account[bundle.account_id] = stmt.doc.filepath

    # ensure deterministic order within account
    for account_id in list(account_txns.keys()):
        account_txns[account_id] = sorted(
            account_txns[account_id],
            key=lambda t: (t.txn_date, t.statement_order, t.source_page, t.source_line),
        )

    all_txns = [t for txns in account_txns.values() for t in txns]

    account_entities = _build_account_entities(account_txns)
    sister_entities = _build_sister_entities(cfg, account_entities)

    classify_transactions(all_txns, config=cfg, account_entities=account_entities, sister_entities=sister_entities)

    sis_mismatch = compute_sis_con_mismatch(all_txns, cfg)
    uw_rollups: dict[str, object] = {}
    for account_id, txns in account_txns.items():
        account_sis = [m for m in sis_mismatch if m.get("from") == account_id or m.get("to") == account_id]
        uw_ctx = build_account_context(txns, sis_con_mismatch=account_sis)
        uw_txns, uw_rollup = apply_underwriting(txns, uw_ctx)
        account_txns[account_id] = uw_txns
        uw_rollups[account_id] = uw_rollup

    overrides = load_overrides(overrides_db)
    if overrides:
        apply_overrides(all_txns, overrides)
        # Recompute SIS mismatch + underwriting after overrides.
        sis_mismatch = compute_sis_con_mismatch(all_txns, cfg)
        account_txns = defaultdict(list)
        for t in all_txns:
            account_txns[t.account_id].append(t)
        uw_rollups = {}
        for account_id, txns in account_txns.items():
            account_sis = [m for m in sis_mismatch if m.get("from") == account_id or m.get("to") == account_id]
            uw_ctx = build_account_context(txns, sis_con_mismatch=account_sis)
            uw_txns, uw_rollup = apply_underwriting(txns, uw_ctx)
            account_txns[account_id] = uw_txns
            uw_rollups[account_id] = uw_rollup

    # Rebuild per-account view on shared objects.
    account_txns = defaultdict(list)
    for t in all_txns:
        account_txns[t.account_id].append(t)

    recon_issues: list[ReconIssue] = list(extraction_issues)
    for account_id, txns in account_txns.items():
        summary, issues = account_recon(
            account_id=account_id,
            source_file=source_file_by_account.get(account_id, txns[0].source_file if txns else ""),
            txns=txns,
            expected_rows=expected_rows_by_account.get(account_id, len(txns)),
            config=cfg,
        )
        recon_summaries.append(summary)
        recon_issues.extend(issues)

    for m in sis_mismatch:
        recon_issues.append(
            ReconIssue(
                severity="WARN",
                code="SIS_CON_MISMATCH",
                message=f"{m['from']} vs {m['to']} delta={m['delta']}",
                source_file="MULTI",
            )
        )

    account_analysis = {acc: compute_analysis(txns) for acc, txns in account_txns.items()}
    cons_rows = compute_cons_by_month(dict(account_txns)) if len(account_txns) >= 2 else []

    hard_fail = any(s.status == "FAIL" for s in recon_summaries)
    if hard_fail:
        final_summary = {
            "avg_monthly_sales": 0.0,
            "avg_monthly_purchase": 0.0,
            "purchase_sales_ratio": 0.0,
            "cash_withdrawal_pct_of_sales": 0.0,
            "bank_fin_avg_monthly_outflow": 0.0,
            "pvt_fin_avg_monthly_outflow": 0.0,
            "assessed_turnover": 0.0,
            "eligible_loan_suggestion": 0.0,
            "risk_flags": ["FINAL_BLOCKED_DUE_TO_RECON_FAIL"],
            "sis_con_mismatch": sis_mismatch,
        }
    else:
        final_summary = compute_final_summary(all_txns, cfg, sis_mismatch)

    if uw_rollups:
        # Conservative aggregate: worst grade and weighted averages.
        grades = [r.uw_health_grade for r in uw_rollups.values()]
        grade_rank = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}
        worst = max(grades, key=lambda g: grade_rank.get(g, 5))
        def_p = sum(r.uw_default_probability for r in uw_rollups.values()) / len(uw_rollups)
        fraud_p = sum(r.uw_fraud_probability for r in uw_rollups.values()) / len(uw_rollups)
        cash_p = sum(r.uw_cash_leakage_pct for r in uw_rollups.values()) / len(uw_rollups)
        hidden_liab = sum(r.uw_hidden_liability_estimate_rupees for r in uw_rollups.values())
        rot = sum(r.uw_rotation_index for r in uw_rollups.values()) / len(uw_rollups)
        risk_txn = sum(r.risk_txn_count for r in uw_rollups.values())
        fraud_txn = sum(r.fraud_suspect_txn_count for r in uw_rollups.values())

        cp_risk: dict[str, float] = defaultdict(float)
        for r in uw_rollups.values():
            for item in r.top_counterparties:
                cp_risk[str(item["counterparty"])] += float(item["uw_amt_risk"])
        top_cp = [
            {"counterparty": k, "uw_amt_risk": round(v, 2)}
            for k, v in sorted(cp_risk.items(), key=lambda kv: kv[1], reverse=True)[:10]
        ]

        verdict_rank = {"APPROVE": 1, "HOLD": 2, "REJECT": 3}
        overall_verdict = max(
            (r.street_verdict for r in uw_rollups.values()),
            key=lambda v: verdict_rank.get(v, 3),
        )
        overall_limit = (
            sum(r.street_limit_suggested_rupees for r in uw_rollups.values())
            if overall_verdict == "APPROVE"
            else 0.0
        )
        overall_haircut = max((r.street_haircut_pct for r in uw_rollups.values()), default=0.0)
        reason_counts: dict[str, int] = defaultdict(int)
        cps: list[str] = []
        monitors: list[str] = []
        for r in uw_rollups.values():
            for rc in r.street_reason_codes:
                reason_counts[rc] += 1
            for cp in r.street_cps:
                if cp not in cps:
                    cps.append(cp)
            for mon in r.street_monitoring_triggers:
                if mon not in monitors:
                    monitors.append(mon)
        top_street_reasons = [k for k, _ in sorted(reason_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:8]]

        final_summary.update(
            {
                "uw_health_grade": worst,
                "uw_default_probability": round(def_p, 2),
                "uw_fraud_probability": round(fraud_p, 2),
                "uw_cash_leakage_pct": round(cash_p, 2),
                "uw_hidden_liability_estimate": round(hidden_liab, 2),
                "uw_rotation_index": round(rot, 4),
                "uw_risk_txn_count": risk_txn,
                "uw_fraud_suspect_txn_count": fraud_txn,
                "top_counterparties": top_cp,
                "street_verdict": overall_verdict,
                "street_limit_suggested": round(overall_limit, 2),
                "street_haircut_pct": round(overall_haircut, 2),
                "street_reason_codes": top_street_reasons,
                "street_cps": cps,
                "street_monitoring_triggers": monitors,
            }
        )

    write_phase2_workbook(
        out_path,
        account_txns=dict(account_txns),
        account_analysis=account_analysis,
        recon_summaries=recon_summaries,
        recon_issues=recon_issues,
        cons_rows=cons_rows,
        final_summary=final_summary,
        underwriting_rollups=uw_rollups,
        config=cfg,
    )

    print(f"out={out_path} accounts={len(account_txns)} txns={len(all_txns)} hard_fail={hard_fail}")
    return 2 if hard_fail else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Money Lender Statement Analyser phase-2 CLI")
    parser.add_argument("--inputs", nargs="+", help="Input PDF statements")
    parser.add_argument("--out", help="Output workbook path")
    parser.add_argument("--config", default="configs/default.yaml", help="Config YAML/JSON path")
    parser.add_argument("--db", default="out/overrides.db", help="Overrides sqlite path")

    parser.add_argument("--override-txn-uid", default=None)
    parser.add_argument("--override-type", default=None)
    parser.add_argument("--override-category", default=None)
    parser.add_argument("--override-notes", default=None)

    args = parser.parse_args()

    if args.override_txn_uid:
        if not args.override_type or not args.override_category:
            raise SystemExit("override requires --override-type and --override-category")
        save_override(
            args.db,
            txn_uid=args.override_txn_uid,
            override_type=args.override_type,
            override_category=args.override_category,
            notes=args.override_notes,
        )
        print(f"override_saved txn_uid={args.override_txn_uid}")
        return 0

    if not args.inputs or not args.out:
        raise SystemExit("--inputs and --out are required")

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    return run_phase2(args.inputs, args.out, args.config, args.db)


if __name__ == "__main__":
    raise SystemExit(main())
