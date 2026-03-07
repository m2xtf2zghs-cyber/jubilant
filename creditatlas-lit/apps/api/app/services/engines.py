from __future__ import annotations

from collections import defaultdict
from datetime import date
from statistics import median

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.entities import (
    BankTransactionNormalized,
    Counterparty,
    CreditBrainResult,
    EmiObligation,
    LoanCase,
    PrivateLenderSignal,
    RiskFlag,
    TruthEngineResult,
)
from app.services.normalization import LENDER_KEYWORDS


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


def _amount(txn: BankTransactionNormalized) -> float:
    return float(txn.amount or 0)


def compute_emi_tracker(db: Session, org_id: str, case_id: str, persist: bool = True) -> list[dict]:
    txns = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .where(BankTransactionNormalized.direction == "DEBIT")
        .order_by(BankTransactionNormalized.txn_date.asc())
    ).all()

    grouped: dict[str, list[BankTransactionNormalized]] = defaultdict(list)
    for txn in txns:
        grouped[(txn.counterparty_name or "UNKNOWN")].append(txn)

    emi_rows: list[dict] = []
    for lender_name, entries in grouped.items():
        if len(entries) < 3:
            continue

        months = sorted({_month_key(e.txn_date) for e in entries})
        if len(months) < 3:
            continue

        amounts = [_amount(e) for e in entries]
        avg_amt = sum(amounts) / len(amounts)
        max_dev = max(abs(a - avg_amt) for a in amounts) / max(avg_amt, 1)
        has_keyword = any(keyword in lender_name for keyword in LENDER_KEYWORDS)
        if max_dev > 0.2 and not has_keyword:
            continue

        day_values = [e.txn_date.day for e in entries]
        expected_day = int(round(median(day_values)))

        month_to_days: dict[str, list[int]] = defaultdict(list)
        for e in entries:
            month_to_days[_month_key(e.txn_date)].append(e.txn_date.day)

        delay_days_by_month: dict[str, int] = {}
        for month, days in month_to_days.items():
            delay_days_by_month[month] = min(abs(day - expected_day) for day in days)

        if months:
            start_year, start_month = map(int, months[0].split("-"))
            end_year, end_month = map(int, months[-1].split("-"))
            all_months: list[str] = []
            y, m = start_year, start_month
            while (y, m) <= (end_year, end_month):
                all_months.append(f"{y:04d}-{m:02d}")
                m += 1
                if m > 12:
                    y += 1
                    m = 1
        else:
            all_months = []

        missed_months = [m for m in all_months if m not in month_to_days]
        cadence_score = len(months) / max(len(all_months), 1)
        amount_score = max(0.0, 1.0 - max_dev)
        keyword_score = 1.0 if has_keyword else 0.6
        confidence = round(min(0.99, 0.35 * cadence_score + 0.4 * amount_score + 0.25 * keyword_score), 2)

        emi_rows.append(
            {
                "lender_name": lender_name,
                "monthly_amount_estimate": round(avg_amt, 2),
                "first_seen": entries[0].txn_date,
                "last_seen": entries[-1].txn_date,
                "expected_day_of_month": expected_day,
                "delay_days_by_month": delay_days_by_month,
                "missed_months": missed_months,
                "confidence": confidence,
            }
        )

    emi_rows.sort(key=lambda x: (x["monthly_amount_estimate"], x["confidence"]), reverse=True)

    if persist:
        db.execute(delete(EmiObligation).where(EmiObligation.case_id == case_id))
        cp_map = {
            cp.canonical_name: cp.id
            for cp in db.scalars(select(Counterparty).where(Counterparty.case_id == case_id)).all()
        }
        for row in emi_rows:
            db.add(
                EmiObligation(
                    org_id=org_id,
                    case_id=case_id,
                    counterparty_id=cp_map.get(row["lender_name"]),
                    lender_name=row["lender_name"],
                    monthly_amount_estimate=row["monthly_amount_estimate"],
                    first_seen=row["first_seen"],
                    last_seen=row["last_seen"],
                    expected_day_of_month=row["expected_day_of_month"],
                    delay_days_by_month=row["delay_days_by_month"],
                    missed_months=row["missed_months"],
                    confidence=row["confidence"],
                )
            )
        db.flush()

    return emi_rows


def compute_street_lenders(db: Session, org_id: str, case_id: str, persist: bool = True) -> list[dict]:
    txns = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .order_by(BankTransactionNormalized.txn_date.asc())
    ).all()

    by_counterparty: dict[str, list[BankTransactionNormalized]] = defaultdict(list)
    for txn in txns:
        by_counterparty[txn.counterparty_name or "UNKNOWN"].append(txn)

    results: list[dict] = []
    for lender_name, entries in by_counterparty.items():
        credits = [e for e in entries if e.direction == "CREDIT"]
        debits = [e for e in entries if e.direction == "DEBIT"]
        if not credits or not debits:
            continue

        round_credits = [c for c in credits if int(_amount(c)) % 10000 == 0]
        if not round_credits:
            continue

        matched_cycles: list[tuple[float, float, int]] = []
        interest_only_hits = 0
        for c in round_credits:
            for d in debits:
                gap_days = (d.txn_date - c.txn_date).days
                if 0 < gap_days <= 45:
                    principal = _amount(c)
                    repay = _amount(d)
                    if principal * 0.95 <= repay <= principal * 1.25:
                        matched_cycles.append((principal, repay, gap_days))
                    elif principal * 0.03 <= repay <= principal * 0.08:
                        interest_only_hits += 1

        if len(matched_cycles) < 2 and interest_only_hits < 2:
            continue

        avg_credit = sum(c[0] for c in matched_cycles) / max(len(matched_cycles), 1)
        avg_repay = sum(c[1] for c in matched_cycles) / max(len(matched_cycles), 1)
        avg_cycle_days = sum(c[2] for c in matched_cycles) / max(len(matched_cycles), 1)
        est_interest = max(0.0, avg_repay - avg_credit)
        pattern_type = "INTEREST_ONLY" if interest_only_hits >= len(matched_cycles) else "ROUND_TRIP"

        recurrence_score = min(1.0, (len(matched_cycles) + interest_only_hits) / 6)
        price_score = 1.0 if avg_repay >= avg_credit else 0.6
        cycle_score = 1.0 if avg_cycle_days <= 45 else 0.5
        confidence = round(min(0.98, 0.45 * recurrence_score + 0.3 * cycle_score + 0.25 * price_score), 2)

        results.append(
            {
                "lender_name": lender_name,
                "confidence": confidence,
                "avg_credit_size": round(avg_credit, 2),
                "avg_repayment_size": round(avg_repay, 2),
                "avg_cycle_days": round(avg_cycle_days, 1),
                "estimated_principal": round(avg_credit, 2),
                "estimated_monthly_interest_burden": round(est_interest, 2),
                "pattern_type": pattern_type,
                "signals": {
                    "matched_cycles": len(matched_cycles),
                    "interest_only_hits": interest_only_hits,
                },
            }
        )

    results.sort(key=lambda x: (x["confidence"], x["estimated_principal"]), reverse=True)

    if persist:
        db.execute(delete(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id))
        cp_map = {
            cp.canonical_name: cp.id
            for cp in db.scalars(select(Counterparty).where(Counterparty.case_id == case_id)).all()
        }
        for row in results:
            db.add(
                PrivateLenderSignal(
                    org_id=org_id,
                    case_id=case_id,
                    counterparty_id=cp_map.get(row["lender_name"]),
                    lender_name=row["lender_name"],
                    confidence=row["confidence"],
                    avg_credit_size=row["avg_credit_size"],
                    avg_repayment_size=row["avg_repayment_size"],
                    avg_cycle_days=row["avg_cycle_days"],
                    estimated_principal=row["estimated_principal"],
                    estimated_monthly_interest_burden=row["estimated_monthly_interest_burden"],
                    pattern_type=row["pattern_type"],
                    signal_payload=row["signals"],
                )
            )
        db.flush()

    return results


def compute_truth_engine(db: Session, org_id: str, case_id: str, persist: bool = True) -> list[dict]:
    txns = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .order_by(BankTransactionNormalized.txn_date.asc())
    ).all()

    private_lenders = {
        row.lender_name.upper()
        for row in db.scalars(
            select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)
        ).all()
    }

    monthly: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "gross_credits": 0.0,
            "internal_transfers_excluded": 0.0,
            "finance_credits_excluded": 0.0,
            "other_non_business_excluded": 0.0,
            "adjusted_business_credits": 0.0,
            "truth_confidence": 0.0,
        }
    )

    for txn in txns:
        month = _month_key(txn.txn_date)
        amount = _amount(txn)
        if txn.direction != "CREDIT":
            continue

        monthly[month]["gross_credits"] += amount
        narration = (txn.narration_clean or "").upper()
        cpty = (txn.counterparty_name or "").upper()

        if txn.category_internal == "INTERNAL_TRANSFER" or any(
            token in narration for token in ["SELF", "OWN", "A2A", "INTERNAL"]
        ):
            monthly[month]["internal_transfers_excluded"] += amount
        elif cpty in private_lenders or any(k in cpty for k in LENDER_KEYWORDS):
            monthly[month]["finance_credits_excluded"] += amount
        elif any(token in narration for token in ["REFUND", "REVERSAL", "CASHBACK"]):
            monthly[month]["other_non_business_excluded"] += amount

    rows: list[dict] = []
    for month, values in sorted(monthly.items()):
        adjusted = (
            values["gross_credits"]
            - values["internal_transfers_excluded"]
            - values["finance_credits_excluded"]
            - values["other_non_business_excluded"]
        )
        adjusted = max(0.0, adjusted)
        exclusion_ratio = (
            values["internal_transfers_excluded"]
            + values["finance_credits_excluded"]
            + values["other_non_business_excluded"]
        ) / max(values["gross_credits"], 1)
        confidence = round(max(0.3, min(0.98, 0.9 - exclusion_ratio * 0.6)), 2)
        values["adjusted_business_credits"] = round(adjusted, 2)
        values["truth_confidence"] = confidence

        rows.append({"period_month": month, **{k: round(v, 2) if k != "truth_confidence" else v for k, v in values.items()}})

    if persist:
        db.execute(delete(TruthEngineResult).where(TruthEngineResult.case_id == case_id))
        for row in rows:
            db.add(
                TruthEngineResult(
                    org_id=org_id,
                    case_id=case_id,
                    period_month=row["period_month"],
                    gross_credits=row["gross_credits"],
                    internal_transfers_excluded=row["internal_transfers_excluded"],
                    finance_credits_excluded=row["finance_credits_excluded"],
                    other_non_business_excluded=row["other_non_business_excluded"],
                    adjusted_business_credits=row["adjusted_business_credits"],
                    truth_confidence=row["truth_confidence"],
                    explain_payload={"formula": "Gross - Internal - Finance - Other"},
                )
            )
        db.flush()

    return rows


def compute_credit_brain(db: Session, org_id: str, case_id: str, persist: bool = True) -> dict:
    truth_rows = db.scalars(
        select(TruthEngineResult)
        .where(TruthEngineResult.case_id == case_id)
        .order_by(TruthEngineResult.period_month.asc())
    ).all()
    emi_rows = db.scalars(select(EmiObligation).where(EmiObligation.case_id == case_id)).all()
    lender_rows = db.scalars(
        select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)
    ).all()

    if truth_rows:
        latest_truth = truth_rows[-1]
        avg_adjusted_sales = sum(float(r.adjusted_business_credits) for r in truth_rows) / len(truth_rows)
        truth_score = round(float(latest_truth.truth_confidence) * 100, 1)
    else:
        avg_adjusted_sales = 0.0
        truth_score = 35.0

    emi_burden = sum(float(r.monthly_amount_estimate) for r in emi_rows)
    emi_burden_ratio = emi_burden / max(avg_adjusted_sales, 1)

    private_burden = sum(float(r.estimated_monthly_interest_burden) for r in lender_rows)
    private_lender_count = len(lender_rows)
    missed_months = sum(len(row.missed_months or []) for row in emi_rows)

    stress_score = round(min(99.0, emi_burden_ratio * 120 + private_lender_count * 8 + missed_months * 3), 1)
    fraud_score = round(
        min(99.0, (100 - truth_score) * 0.5 + private_lender_count * 9 + max(0, 20 if private_burden > 0 else 0)),
        1,
    )

    positives: list[str] = []
    concerns: list[str] = []
    conditions: list[str] = []

    if truth_score >= 75:
        positives.append("High truth confidence in adjusted business credits")
    if emi_burden_ratio < 0.25:
        positives.append("Existing EMI burden appears serviceable")
    if private_lender_count == 0:
        positives.append("No strong hidden private finance pattern detected")

    if emi_burden_ratio >= 0.35:
        concerns.append("EMI burden is elevated relative to true sales")
    if private_lender_count >= 2:
        concerns.append("Multiple probable private lenders found in transaction graph")
    if missed_months >= 2:
        concerns.append("Missed EMI months suggest repayment stress")
    if fraud_score >= 60:
        concerns.append("Fraud risk indicators need analyst review")

    decision = "REVIEW_CAUTION"
    grade = "C"

    if truth_score >= 80 and stress_score < 35 and fraud_score < 35:
        decision = "APPROVE"
        grade = "A"
    elif truth_score >= 70 and stress_score < 50 and fraud_score < 45:
        decision = "APPROVE_WITH_CONDITIONS"
        grade = "B"
        conditions.extend(["Obtain latest GST filing proof", "Mandate escrow route for receivables"])
    elif truth_score >= 60 and stress_score < 65:
        decision = "REVIEW_POSITIVE"
        grade = "B-"
        conditions.append("Verify top 5 customers through call checks")
    elif truth_score < 45 or fraud_score > 75:
        decision = "DECLINE"
        grade = "D"
        conditions.append("Re-apply after 6 months of cleaner banking behavior")
    else:
        decision = "REVIEW_CAUTION"
        grade = "C"
        conditions.extend(
            [
                "Reduce informal lender dependency before disbursal",
                "Collect 6-month additional bank statements",
            ]
        )

    exposure_base = max(avg_adjusted_sales * 0.2, 250000)
    exposure_min = round(max(100000, exposure_base * (0.6 - stress_score / 250)), 2)
    exposure_max = round(max(exposure_min, exposure_base * (1.1 - fraud_score / 200)), 2)

    narrative = (
        f"Decision {decision}: truth score {truth_score}, stress score {stress_score}, fraud score {fraud_score}. "
        f"Adjusted monthly sales baseline is {avg_adjusted_sales:,.0f}, with EMI burden {emi_burden:,.0f} "
        f"and estimated private interest burden {private_burden:,.0f}."
    )

    result = {
        "decision": decision,
        "grade": grade,
        "truth_score": truth_score,
        "stress_score": stress_score,
        "fraud_score": fraud_score,
        "suggested_exposure_min": exposure_min,
        "suggested_exposure_max": exposure_max,
        "key_positives": positives,
        "key_concerns": concerns,
        "conditions_precedent": conditions,
        "narrative": narrative,
    }

    if persist:
        existing = db.scalar(select(CreditBrainResult).where(CreditBrainResult.case_id == case_id))
        if not existing:
            existing = CreditBrainResult(org_id=org_id, case_id=case_id, **result, explain_payload={})
            db.add(existing)
        else:
            for key, value in result.items():
                setattr(existing, key, value)

        _refresh_risk_flags(db, org_id, case_id, stress_score, fraud_score, private_lender_count, missed_months)

        case_row = db.get(LoanCase, case_id)
        if case_row:
            case_row.decision_badge = decision

        db.flush()

    return result


def _refresh_risk_flags(
    db: Session,
    org_id: str,
    case_id: str,
    stress_score: float,
    fraud_score: float,
    private_lender_count: int,
    missed_months: int,
) -> None:
    db.execute(delete(RiskFlag).where(RiskFlag.case_id == case_id))

    if stress_score >= 60:
        db.add(
            RiskFlag(
                org_id=org_id,
                case_id=case_id,
                code="HIGH_STRESS",
                severity="HIGH",
                title="Repayment Stress Elevated",
                description="EMI and private finance burden indicate high stress on cash flows.",
                metric_value=stress_score,
            )
        )
    if fraud_score >= 65:
        db.add(
            RiskFlag(
                org_id=org_id,
                case_id=case_id,
                code="FRAUD_ATTENTION",
                severity="HIGH",
                title="Fraud Signal Watch",
                description="Pattern variance and financing behavior require enhanced diligence.",
                metric_value=fraud_score,
            )
        )
    if private_lender_count >= 2:
        db.add(
            RiskFlag(
                org_id=org_id,
                case_id=case_id,
                code="MULTI_PRIVATE_LENDERS",
                severity="MEDIUM",
                title="Hidden Private Lenders",
                description="Multiple informal financiers detected in circular credit/debit cycles.",
                metric_value=float(private_lender_count),
            )
        )
    if missed_months >= 2:
        db.add(
            RiskFlag(
                org_id=org_id,
                case_id=case_id,
                code="MISSED_EMI_PATTERN",
                severity="MEDIUM",
                title="Missed EMI Pattern",
                description="Observed gaps in expected monthly lender repayments.",
                metric_value=float(missed_months),
            )
        )


def run_all_engines(db: Session, org_id: str, case_id: str) -> dict:
    emi = compute_emi_tracker(db, org_id, case_id, persist=True)
    lenders = compute_street_lenders(db, org_id, case_id, persist=True)
    truth = compute_truth_engine(db, org_id, case_id, persist=True)
    credit = compute_credit_brain(db, org_id, case_id, persist=True)
    return {"emi": emi, "street_lenders": lenders, "truth": truth, "credit_brain": credit}
