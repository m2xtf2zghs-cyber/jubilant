from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import timedelta
from statistics import mean

from core.canonical_models import CanonicalTransaction


@dataclass
class AccountContext:
    account_id: str
    monthly_sales: dict[str, float]
    monthly_purchases: dict[str, float]
    monthly_cash_withdraw: dict[str, float]
    monthly_bounces: dict[str, int]
    party_txns: dict[str, list[CanonicalTransaction]]
    sis_con_mismatch: list[dict[str, object]]
    has_od_stress: bool


@dataclass
class UnderwritingRollup:
    account_id: str
    uw_health_grade: str
    uw_default_probability: float
    uw_fraud_probability: float
    uw_cash_leakage_pct: float
    uw_hidden_liability_estimate_rupees: float
    uw_rotation_index: float
    avg_uw_score: float
    risk_txn_count: int
    fraud_suspect_txn_count: int
    top_counterparties: list[dict[str, object]]
    street_verdict: str
    street_limit_suggested_rupees: float
    street_haircut_pct: float
    street_reason_codes: list[str]
    street_cps: list[str]
    street_monitoring_triggers: list[str]


_BUCKET_ORDER = {"OK": 0, "WATCH": 1, "RISK": 2, "FRAUD_SUSPECT": 3}
_RISK_MULTIPLIERS = {"OK": 0.25, "WATCH": 0.75, "RISK": 1.25, "FRAUD_SUSPECT": 2.0}


def _pct(part: float, whole: float) -> float:
    if whole <= 0:
        return 0.0
    return (part / whole) * 100.0


def _is_round_lakh(amount: float) -> bool:
    return amount > 0 and int(round(amount)) % 100000 == 0


def _txn_amount(txn: CanonicalTransaction) -> float:
    return txn.cr_amount if txn.cr_amount > 0 else txn.dr_amount


def _clamp(score: float) -> int:
    return int(max(0, min(100, round(score))))


def _bucket_from_score(score: int) -> str:
    if score >= 80:
        return "OK"
    if score >= 60:
        return "WATCH"
    if score >= 40:
        return "RISK"
    return "FRAUD_SUSPECT"


def _more_severe(a: str, b: str) -> str:
    return a if _BUCKET_ORDER[a] >= _BUCKET_ORDER[b] else b


def _counterparty_risk(txn: CanonicalTransaction, tags: set[str]) -> str:
    if txn.type_code in {"PVT FIN", "ODD FIG"} or "DIVERSION_SUSPECT" in tags:
        return "HIGH"
    if txn.type_code in {"DOUBT", "RETURN"}:
        return "MED"
    return "LOW"


def _is_material_sis_diversion(txn: CanonicalTransaction, mismatches: list[dict[str, object]]) -> bool:
    if txn.type_code != "SIS CON" or not mismatches:
        return False
    text = f"{txn.account_id} {txn.category_clean}".upper()
    for mm in mismatches:
        a = str(mm.get("from", "")).upper()
        b = str(mm.get("to", "")).upper()
        if a and a in text:
            return True
        if b and b in text:
            return True
    return True


def _build_street_cps(
    *,
    fraud_or_accommodation: bool,
    has_pvt_fin: bool,
    has_sis_mismatch: bool,
    has_cash_leakage: bool,
    has_bounces: bool,
) -> list[str]:
    cps: list[str] = []
    if fraud_or_accommodation:
        cps.append(
            "CP1: Provide source documents for top 10 ODD FIG/FRAUD credits (PAN + bank proof + loan agreements)."
        )
        cps.append("CP2: Written declaration that these are borrowings/capital and not sales.")
    if has_pvt_fin:
        cps.append("CP3: Disclose full private finance ledger (party-wise) with outstanding confirmations.")
        cps.append("CP4: Provide bank proof of closures for lenders with bidirectional flows.")
    if has_sis_mismatch:
        cps.append(
            "CP5: Provide inter-company ledgers and GST returns for sister entities, with mismatch explanation."
        )
    if has_cash_leakage:
        cps.append(
            "CP6: Provide cashbook and invoice mapping; reduce cash withdrawals below threshold for 2 months."
        )
    if has_bounces:
        cps.append(
            "CP7: Provide bounce explanations and settlement proof; no bounces for next 30 days before disbursal."
        )
    if not cps:
        cps.append("No additional CPs triggered.")
    return cps


def build_account_context(
    transactions: list[CanonicalTransaction],
    *,
    sis_con_mismatch: list[dict[str, object]] | None = None,
) -> AccountContext:
    sis_con_mismatch = sis_con_mismatch or []
    account_id = transactions[0].account_id if transactions else "UNKNOWN"

    monthly_sales: dict[str, float] = defaultdict(float)
    monthly_purchases: dict[str, float] = defaultdict(float)
    monthly_cash_withdraw: dict[str, float] = defaultdict(float)
    monthly_bounces: dict[str, int] = defaultdict(int)
    party_txns: dict[str, list[CanonicalTransaction]] = defaultdict(list)

    bal_count = 0
    neg_bal_count = 0
    for txn in transactions:
        if txn.type_code == "SALES":
            monthly_sales[txn.month_label] += txn.cr_amount
        if txn.type_code == "PURCHASE":
            monthly_purchases[txn.month_label] += txn.dr_amount
        if txn.type_code == "CASH" and txn.dr_amount > 0:
            monthly_cash_withdraw[txn.month_label] += txn.dr_amount
        if txn.type_code == "RETURN":
            monthly_bounces[txn.month_label] += 1
        party = (txn.category_clean or "").upper().strip()
        if party:
            party_txns[party].append(txn)
        if txn.balance is not None:
            bal_count += 1
            if txn.balance < 0:
                neg_bal_count += 1

    has_od_stress = False
    if transactions and transactions[0].account_type in {"OD", "CC"} and bal_count > 0:
        has_od_stress = (neg_bal_count / bal_count) >= 0.25

    return AccountContext(
        account_id=account_id,
        monthly_sales=dict(monthly_sales),
        monthly_purchases=dict(monthly_purchases),
        monthly_cash_withdraw=dict(monthly_cash_withdraw),
        monthly_bounces=dict(monthly_bounces),
        party_txns=dict(party_txns),
        sis_con_mismatch=sis_con_mismatch,
        has_od_stress=has_od_stress,
    )


def apply_underwriting(
    txns: list[CanonicalTransaction],
    account_ctx: AccountContext,
) -> tuple[list[CanonicalTransaction], UnderwritingRollup]:
    if not txns:
        return txns, UnderwritingRollup(
            account_id=account_ctx.account_id,
            uw_health_grade="E",
            uw_default_probability=0.0,
            uw_fraud_probability=0.0,
            uw_cash_leakage_pct=0.0,
            uw_hidden_liability_estimate_rupees=0.0,
            uw_rotation_index=0.0,
            avg_uw_score=0.0,
            risk_txn_count=0,
            fraud_suspect_txn_count=0,
            top_counterparties=[],
            street_verdict="HOLD",
            street_limit_suggested_rupees=0.0,
            street_haircut_pct=0.0,
            street_reason_codes=[],
            street_cps=["No data."],
            street_monitoring_triggers=[],
        )

    ordered = sorted(txns, key=lambda t: (t.txn_date, t.statement_order, t.source_page, t.source_line))

    # Contextual buckets
    cash_leakage_months = {
        m for m, cash in account_ctx.monthly_cash_withdraw.items() if cash > 0 and cash > 0.30 * max(account_ctx.monthly_sales.get(m, 0.0), 1.0)
    }
    bounce_cluster_months = {m for m, c in account_ctx.monthly_bounces.items() if c >= 2}
    sis_diversion_exists = len(account_ctx.sis_con_mismatch) > 0

    party_bidirectional: dict[str, bool] = {}
    borrow_repay_loop_parties: set[str] = set()
    pvt_recurring_parties: set[str] = set()

    for party, ptxns in account_ctx.party_txns.items():
        dr_total = sum(t.dr_amount for t in ptxns)
        cr_total = sum(t.cr_amount for t in ptxns)
        party_bidirectional[party] = dr_total > 0 and cr_total > 0

        round_credit_dates = [t.txn_date for t in ptxns if t.cr_amount > 0 and _is_round_lakh(t.cr_amount)]
        debit_dates = [t.txn_date for t in ptxns if t.dr_amount > 0]
        if round_credit_dates and debit_dates:
            if max(debit_dates) >= min(round_credit_dates):
                borrow_repay_loop_parties.add(party)

        pvt_debits = [t.dr_amount for t in ptxns if t.type_code == "PVT FIN" and t.dr_amount > 0]
        pvt_months = {t.month_label for t in ptxns if t.type_code == "PVT FIN" and t.dr_amount > 0}
        if len(pvt_months) >= 3 and len(pvt_debits) >= 3:
            avg_amt = sum(pvt_debits) / len(pvt_debits)
            band = avg_amt * 0.05
            similar_count = sum(1 for amt in pvt_debits if abs(amt - avg_amt) <= band)
            if similar_count >= 3:
                pvt_recurring_parties.add(party)

    monthly_positive_applied: dict[str, float] = defaultdict(float)
    monthly_penal_count: dict[str, int] = defaultdict(int)
    risk_by_party: dict[str, float] = defaultdict(float)
    reason_counter: Counter[str] = Counter()

    for txn in ordered:
        score = 100.0
        floor_bucket = "OK"
        reasons: set[str] = set()
        tags: set[str] = set()
        notes: list[str] = []

        party = (txn.category_clean or "").upper().strip()
        bidirectional = party_bidirectional.get(party, False)
        amount = _txn_amount(txn)

        # A) accommodation / turnover suspicion
        if txn.type_code == "SALES" and txn.cr_amount > 0 and _is_round_lakh(txn.cr_amount):
            reasons.add("ROUND_CREDIT_IN_SALES")
            tags.add("ACCOMMODATION_ENTRY")
            score -= 15
            floor_bucket = _more_severe(floor_bucket, "WATCH")

        if txn.type_code == "ODD FIG" and txn.cr_amount >= 500000:
            reasons.add("ACCOMMODATION_ENTRY")
            tags.update({"STREET_LENDER", "ACCOMMODATION_ENTRY"})
            score -= 25
            floor_bucket = _more_severe(floor_bucket, "RISK")

        # B) aggressive rules
        if txn.type_code == "ODD FIG" and txn.cr_amount >= 1000000:
            reasons.add("ACCOMMODATION_ENTRY_10L_PLUS")
            tags.update({"STREET_LENDER", "ACCOMMODATION_ENTRY"})
            score = min(score, 35.0)
            floor_bucket = _more_severe(floor_bucket, "FRAUD_SUSPECT")
            notes.append(
                "ODD FIG credit >=10L treated as accommodation/private borrowing; verify source and purpose."
            )

        if party and (bidirectional or party in borrow_repay_loop_parties):
            score = min(score, 25.0)
            reasons.add("BORROW_REPAY_LOOP")
            tags.add("ROTATION")
            floor_bucket = _more_severe(floor_bucket, "RISK")

        # C) private finance network
        if txn.type_code == "PVT FIN":
            reasons.add("PVT_FIN_TXN")
            tags.add("STREET_LENDER")
            score -= 25
            floor_bucket = _more_severe(floor_bucket, "RISK")
            if party and party in pvt_recurring_parties:
                reasons.add("PVT_EMI_PATTERN")
                score -= 10
            if bidirectional:
                reasons.add("BIDIRECTIONAL_LENDER")
                score -= 15
            if txn.cr_amount >= 1000000:
                reasons.add("LARGE_PRIVATE_BORROWING")
                score -= 35
                floor_bucket = _more_severe(floor_bucket, "RISK")

        # D) bank stress
        if txn.type_code == "BANK FIN":
            if any(k in txn.narration_norm for k in ["PENAL", "BOUNCE", "CHARGE", "CHRGS"]):
                reasons.add("PENAL_CHARGE")
                score -= 10
                floor_bucket = _more_severe(floor_bucket, "WATCH")
                monthly_penal_count[txn.month_label] += 1
            if account_ctx.has_od_stress and any(k in txn.narration_norm for k in ["INT.COLL", "INT COLL", "INTEREST"]):
                reasons.add("OD_STRESS")
                tags.add("OD_STRESS")
                score -= 25
                floor_bucket = _more_severe(floor_bucket, "RISK")

        # E) cash leakage
        if txn.type_code == "CASH" and txn.dr_amount >= 100000:
            reasons.add("HIGH_CASH_WITHDRAWAL")
            score -= 10
            floor_bucket = _more_severe(floor_bucket, "WATCH")
        if txn.type_code == "CASH" and txn.dr_amount > 0 and txn.month_label in cash_leakage_months:
            reasons.add("CASH_LEAKAGE_MONTH")
            tags.add("CASH_LEAKAGE")
            score -= 20
            floor_bucket = _more_severe(floor_bucket, "RISK")

        # F) returns
        if txn.type_code == "RETURN":
            reasons.add("BOUNCE")
            score -= 15
            floor_bucket = _more_severe(floor_bucket, "WATCH")
            if txn.month_label in bounce_cluster_months:
                reasons.add("BOUNCE_CLUSTER")
                score -= 15
                floor_bucket = _more_severe(floor_bucket, "RISK")

        # G) sis con diversion
        if _is_material_sis_diversion(txn, account_ctx.sis_con_mismatch):
            reasons.add("SIS_CON_DIVERSION")
            tags.add("DIVERSION_SUSPECT")
            score -= 30
            floor_bucket = _more_severe(floor_bucket, "RISK")

        # H) doubt
        if txn.type_code == "DOUBT":
            reasons.add("UNEXPLAINED_TXN")
            score -= 15
            floor_bucket = _more_severe(floor_bucket, "WATCH")
            if amount >= 200000:
                score -= 10
                floor_bucket = _more_severe(floor_bucket, "RISK")

        # I) compliance positives (+6 monthly cap)
        cat = (txn.category_clean or "").upper()
        if txn.type_code == "EXPENSE" and cat in {"GST", "CBDT TAX", "TAX"}:
            remaining = max(0.0, 6.0 - monthly_positive_applied[txn.month_label])
            if remaining > 0:
                bonus = min(3.0, remaining)
                score += bonus
                monthly_positive_applied[txn.month_label] += bonus
            tags.add("COMPLIANCE_SIGNAL")
            reasons.add("COMPLIANCE_SIGNAL")

        score = _clamp(score)
        score_bucket = _bucket_from_score(score)
        bucket = _more_severe(score_bucket, floor_bucket)

        # Keep score-band deterministic with forced bucket floors.
        if bucket == "WATCH" and score >= 80:
            score = 79
        elif bucket == "RISK" and score >= 60:
            score = 59
        elif bucket == "FRAUD_SUSPECT" and score >= 40:
            score = 39

        uw_amt_risk = round(amount * _RISK_MULTIPLIERS[bucket], 2)
        counterparty_risk = _counterparty_risk(txn, tags)

        txn.uw_score = score
        txn.uw_bucket = bucket
        txn.uw_reasons = sorted(reasons)
        txn.uw_tags = sorted(tags)
        txn.uw_amt_risk = uw_amt_risk
        txn.uw_counterparty_risk = counterparty_risk
        txn.uw_notes = " | ".join(notes) if notes else ("; ".join(sorted(reasons)[:2]) if reasons else "No notable UW signal.")

        if bucket in {"WATCH", "RISK", "FRAUD_SUSPECT"}:
            reason_counter.update(txn.uw_reasons)
        risk_by_party[party or "UNKNOWN"] += uw_amt_risk

    scores = [t.uw_score for t in ordered]
    avg_score = float(mean(scores)) if scores else 100.0

    months = {t.month_label for t in ordered}
    month_div = max(len(months), 1)

    total_sales = sum(t.cr_amount for t in ordered if t.type_code == "SALES")
    total_cash_withdraw = sum(t.dr_amount for t in ordered if t.type_code == "CASH")
    total_credits = sum(t.cr_amount for t in ordered if t.cr_amount > 0)
    avg_monthly_sales = total_sales / month_div

    bank_fin_debit = sum(t.dr_amount for t in ordered if t.type_code == "BANK FIN")
    pvt_fin_debit = sum(t.dr_amount for t in ordered if t.type_code == "PVT FIN")
    avg_monthly_oblig = (bank_fin_debit + pvt_fin_debit) / month_div
    avg_monthly_pvt_debit = pvt_fin_debit / month_div

    # Hidden liability estimate
    pvt_net_negative = 0.0
    pvt_party_net: dict[str, float] = defaultdict(float)
    for t in ordered:
        if t.type_code == "PVT FIN":
            pvt_party_net[(t.category_clean or "UNKNOWN").upper()] += t.cr_amount - t.dr_amount
    for net in pvt_party_net.values():
        if net < 0:
            pvt_net_negative += abs(net)
    hidden_liability = max(0.0, pvt_net_negative) + (avg_monthly_pvt_debit * 6.0)

    # Rotation index: large round credits followed by outflow within 7 days.
    large_round_credits = [t for t in ordered if t.cr_amount >= 500000 and _is_round_lakh(t.cr_amount)]
    total_large_round = sum(t.cr_amount for t in large_round_credits)
    fast_outflow = 0.0
    debits = [t for t in ordered if t.dr_amount > 0]
    for c in large_round_credits:
        window_end = c.txn_date + timedelta(days=7)
        fast_outflow += sum(d.dr_amount for d in debits if c.txn_date <= d.txn_date <= window_end)
    rotation_index = min(1.0, fast_outflow / max(total_large_round, 1.0))

    cash_leakage_pct = _pct(total_cash_withdraw, max(total_sales, 1.0))
    risk_txn_count = sum(1 for t in ordered if t.uw_bucket in {"RISK", "FRAUD_SUSPECT"})
    fraud_suspect_txn_count = sum(1 for t in ordered if t.uw_bucket == "FRAUD_SUSPECT")
    fraud_suspect_credit_count = sum(1 for t in ordered if t.uw_bucket == "FRAUD_SUSPECT" and t.cr_amount > 0)
    fraud_suspect_credit_amt = sum(t.cr_amount for t in ordered if t.uw_bucket == "FRAUD_SUSPECT")
    fraud_suspect_credit_amt_pct = _pct(fraud_suspect_credit_amt, max(total_credits, 1.0))
    odd_fig_credit_amt = sum(t.cr_amount for t in ordered if t.type_code == "ODD FIG")
    odd_fig_credit_pct = _pct(odd_fig_credit_amt, max(total_credits, 1.0))
    sis_mismatch_rupees = sum(float(m.get("delta", 0.0)) for m in account_ctx.sis_con_mismatch)
    sis_mismatch_pct = _pct(sis_mismatch_rupees, max(total_credits, 1.0))
    max_bounces_month = max(account_ctx.monthly_bounces.values(), default=0)
    pvt_fin_monthly_outflow_pct = _pct(avg_monthly_pvt_debit, max(avg_monthly_sales, 1.0))

    fraud_probability = min(
        95.0,
        5.0
        + (fraud_suspect_credit_amt_pct * 0.45)
        + (odd_fig_credit_pct * 0.35)
        + (sis_mismatch_pct * 0.8)
        + (len(bounce_cluster_months) * 6.0),
    )
    obligations_ratio = (avg_monthly_oblig / max(avg_monthly_sales, 1.0)) if avg_monthly_sales > 0 else 99.0
    default_probability = min(
        95.0,
        8.0
        + (15.0 if account_ctx.has_od_stress else 0.0)
        + min(20.0, sum(1 for _, c in monthly_penal_count.items() if c > 0) * 4.0)
        + min(20.0, max_bounces_month * 4.0)
        + min(20.0, cash_leakage_pct * 0.3)
        + min(20.0, max(0.0, obligations_ratio - 1.0) * 18.0),
    )

    if fraud_probability < 10 and default_probability < 10 and odd_fig_credit_pct < 10:
        grade = "A"
    elif fraud_probability < 20 and default_probability < 20:
        grade = "B"
    elif fraud_probability < 35 or default_probability < 35:
        grade = "C"
    elif fraud_probability < 50 or default_probability < 50:
        grade = "D"
    else:
        grade = "E"

    # Street lender verdict (hard-coded deterministic logic)
    reject_reasons: list[str] = []
    if fraud_suspect_credit_count >= 3 or fraud_suspect_credit_amt_pct >= 25:
        reject_reasons.append("FRAUD_SUSPECT_INTENSITY")
    if odd_fig_credit_pct >= 30:
        reject_reasons.append("ODD_FIG_HEAVY")
    if sis_mismatch_pct >= 10 or sis_mismatch_rupees >= 2500000:
        reject_reasons.append("SIS_CON_MISMATCH_HIGH")
    if max_bounces_month >= 3:
        reject_reasons.append("BOUNCE_3PLUS")
    if (avg_monthly_sales <= 0 and avg_monthly_pvt_debit > 0) or pvt_fin_monthly_outflow_pct >= 15:
        reject_reasons.append("PVT_FIN_BURDEN_HIGH")
    if (avg_monthly_sales <= 0 and total_cash_withdraw > 0) or cash_leakage_pct >= 40:
        reject_reasons.append("CASH_LEAKAGE_EXTREME")

    hold_reasons: list[str] = []
    if not reject_reasons:
        if fraud_suspect_credit_count in {1, 2}:
            hold_reasons.append("FRAUD_SUSPECT_PRESENT")
        if 15 <= odd_fig_credit_pct < 30:
            hold_reasons.append("ODD_FIG_15_30")
        if 5 <= sis_mismatch_pct < 10:
            hold_reasons.append("SIS_CON_MISMATCH_5_10")
        if max_bounces_month >= 2:
            hold_reasons.append("BOUNCE_2")
        if 8 <= pvt_fin_monthly_outflow_pct < 15:
            hold_reasons.append("PVT_FIN_BURDEN_8_15")
        if 25 <= cash_leakage_pct < 40:
            hold_reasons.append("CASH_LEAKAGE_25_40")
        if account_ctx.has_od_stress or sum(1 for _, c in monthly_penal_count.items() if c > 0) >= 2:
            hold_reasons.append("OD_STRESS_OR_PENAL")

    if reject_reasons:
        street_verdict = "REJECT"
    elif hold_reasons:
        street_verdict = "HOLD"
    else:
        street_verdict = "APPROVE"

    # Limit and haircut
    haircut = 0.0
    if 10 <= odd_fig_credit_pct < 15:
        haircut += 10
    if 15 <= odd_fig_credit_pct < 30:
        haircut += 25
    if fraud_suspect_txn_count > 0:
        haircut += 30
    if 8 <= pvt_fin_monthly_outflow_pct < 15:
        haircut += 15
    if pvt_fin_monthly_outflow_pct > 15:
        haircut += 30
    if 25 <= cash_leakage_pct < 40:
        haircut += 15
    if cash_leakage_pct > 40:
        haircut += 30
    if max_bounces_month >= 2:
        haircut += 20
    if 5 <= sis_mismatch_pct < 10:
        haircut += 20
    haircut = min(70.0, haircut)

    street_limit = 0.0
    if street_verdict == "APPROVE":
        street_limit = max(500000.0, avg_monthly_sales * (1.0 - haircut / 100.0))

    if street_verdict != "REJECT" and avg_monthly_oblig > 0 and (avg_monthly_sales / avg_monthly_oblig) < 2.0:
        street_verdict = "HOLD"
        street_limit = 0.0
        hold_reasons.append("OBLIGATION_COVERAGE_LT_2")

    # Reason codes top 8
    trigger_reason_counts = Counter(reason_counter)
    for code in reject_reasons + hold_reasons:
        trigger_reason_counts[code] += 1
    street_reason_codes = [r for r, _ in trigger_reason_counts.most_common(8)]

    fraud_or_accommodation = any(
        rc in set(street_reason_codes)
        for rc in {
            "ACCOMMODATION_ENTRY",
            "ACCOMMODATION_ENTRY_10L_PLUS",
            "ROUND_CREDIT_IN_SALES",
            "BORROW_REPAY_LOOP",
            "FRAUD_SUSPECT_INTENSITY",
            "FRAUD_SUSPECT_PRESENT",
            "ODD_FIG_HEAVY",
        }
    )
    street_cps = _build_street_cps(
        fraud_or_accommodation=fraud_or_accommodation,
        has_pvt_fin=any(t.type_code == "PVT FIN" for t in ordered),
        has_sis_mismatch=sis_diversion_exists,
        has_cash_leakage=cash_leakage_pct >= 25,
        has_bounces=max_bounces_month >= 2,
    )
    street_monitoring_triggers = [
        "Any bounce post-disbursal -> freeze top-up.",
        "Cash withdrawal >30% of monthly sales -> reduce drawing power.",
        "New ODD FIG credit >=10L -> immediate review.",
        "PVT FIN EMI increases month-on-month -> stress alert.",
    ]

    top_counterparties = [
        {"counterparty": cp, "uw_amt_risk": round(amt, 2)}
        for cp, amt in sorted(risk_by_party.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

    rollup = UnderwritingRollup(
        account_id=account_ctx.account_id,
        uw_health_grade=grade,
        uw_default_probability=round(default_probability, 2),
        uw_fraud_probability=round(fraud_probability, 2),
        uw_cash_leakage_pct=round(cash_leakage_pct, 2),
        uw_hidden_liability_estimate_rupees=round(hidden_liability, 2),
        uw_rotation_index=round(rotation_index, 4),
        avg_uw_score=round(avg_score, 2),
        risk_txn_count=risk_txn_count,
        fraud_suspect_txn_count=fraud_suspect_txn_count,
        top_counterparties=top_counterparties,
        street_verdict=street_verdict,
        street_limit_suggested_rupees=round(street_limit, 2),
        street_haircut_pct=round(haircut, 2),
        street_reason_codes=street_reason_codes,
        street_cps=street_cps,
        street_monitoring_triggers=street_monitoring_triggers,
    )
    return ordered, rollup
