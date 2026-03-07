from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_analyst_auth
from app.db.session import get_db
from app.models.entities import (
    BankTransactionNormalized,
    Counterparty,
    CreditBrainResult,
    EmiObligation,
    LoanCase,
    PrivateLenderSignal,
    TruthEngineResult,
)
from app.schemas.common import (
    CounterpartyOut,
    CreditBrainOut,
    EmiOut,
    MonthlySummaryRow,
    StreetLenderOut,
    TransactionOut,
    TruthOut,
)
from app.services.engines import (
    compute_credit_brain,
    compute_emi_tracker,
    compute_street_lenders,
    compute_truth_engine,
)

router = APIRouter(prefix="/cases/{case_id}", tags=["intelligence"])


def _require_case(db: Session, case_id: str, org_id: str) -> LoanCase:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    case_id: str,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[TransactionOut]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .where(BankTransactionNormalized.org_id == auth.org_id)
        .order_by(BankTransactionNormalized.txn_date.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return [
        TransactionOut(
            id=row.id,
            txn_date=row.txn_date,
            amount=float(row.amount),
            direction=row.direction,
            narration_clean=row.narration_clean,
            counterparty_name=row.counterparty_name,
            category_internal=row.category_internal,
            source_vendor=row.source_vendor,
        )
        for row in rows
    ]


@router.get("/transactions/monthly-summary", response_model=list[MonthlySummaryRow])
def monthly_summary(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[MonthlySummaryRow]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(
        select(BankTransactionNormalized)
        .where(BankTransactionNormalized.case_id == case_id)
        .where(BankTransactionNormalized.org_id == auth.org_id)
    ).all()

    month_rollup = defaultdict(lambda: {"credits": 0.0, "debits": 0.0})
    for row in rows:
        month = row.txn_date.strftime("%Y-%m")
        amount = float(row.amount)
        if row.direction == "CREDIT":
            month_rollup[month]["credits"] += amount
        else:
            month_rollup[month]["debits"] += amount

    return [
        MonthlySummaryRow(
            month=month,
            credits=round(values["credits"], 2),
            debits=round(values["debits"], 2),
            net=round(values["credits"] - values["debits"], 2),
        )
        for month, values in sorted(month_rollup.items())
    ]


@router.get("/counterparties", response_model=list[CounterpartyOut])
def counterparties(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[CounterpartyOut]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(
        select(Counterparty)
        .where(Counterparty.case_id == case_id)
        .where(Counterparty.org_id == auth.org_id)
        .order_by(Counterparty.txn_count.desc())
    ).all()

    return [
        CounterpartyOut(
            id=row.id,
            canonical_name=row.canonical_name,
            total_credits=float(row.total_credits),
            total_debits=float(row.total_debits),
            txn_count=row.txn_count,
        )
        for row in rows
    ]


@router.get("/emi-tracker", response_model=list[EmiOut])
def emi_tracker(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[EmiOut]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(select(EmiObligation).where(EmiObligation.case_id == case_id)).all()
    if not rows:
        compute_emi_tracker(db, auth.org_id, case_id, persist=True)
        db.commit()
        rows = db.scalars(select(EmiObligation).where(EmiObligation.case_id == case_id)).all()

    return [
        EmiOut(
            lender_name=row.lender_name,
            monthly_amount_estimate=float(row.monthly_amount_estimate),
            first_seen=row.first_seen,
            last_seen=row.last_seen,
            expected_day_of_month=row.expected_day_of_month,
            delay_days_by_month=row.delay_days_by_month,
            missed_months=row.missed_months,
            confidence=row.confidence,
        )
        for row in rows
    ]


@router.get("/street-lender-intelligence", response_model=list[StreetLenderOut])
def street_lender_intelligence(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[StreetLenderOut]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)).all()
    if not rows:
        compute_street_lenders(db, auth.org_id, case_id, persist=True)
        db.commit()
        rows = db.scalars(select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)).all()

    return [
        StreetLenderOut(
            lender_name=row.lender_name,
            confidence=row.confidence,
            avg_credit_size=float(row.avg_credit_size),
            avg_repayment_size=float(row.avg_repayment_size),
            avg_cycle_days=float(row.avg_cycle_days),
            estimated_principal=float(row.estimated_principal),
            estimated_monthly_interest_burden=float(row.estimated_monthly_interest_burden),
            pattern_type=row.pattern_type,
        )
        for row in rows
    ]


@router.get("/truth-engine", response_model=list[TruthOut])
def truth_engine(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> list[TruthOut]:
    _require_case(db, case_id, auth.org_id)

    rows = db.scalars(
        select(TruthEngineResult)
        .where(TruthEngineResult.case_id == case_id)
        .order_by(TruthEngineResult.period_month.asc())
    ).all()
    if not rows:
        compute_truth_engine(db, auth.org_id, case_id, persist=True)
        db.commit()
        rows = db.scalars(
            select(TruthEngineResult)
            .where(TruthEngineResult.case_id == case_id)
            .order_by(TruthEngineResult.period_month.asc())
        ).all()

    return [
        TruthOut(
            period_month=row.period_month,
            gross_credits=float(row.gross_credits),
            internal_transfers_excluded=float(row.internal_transfers_excluded),
            finance_credits_excluded=float(row.finance_credits_excluded),
            other_non_business_excluded=float(row.other_non_business_excluded),
            adjusted_business_credits=float(row.adjusted_business_credits),
            truth_confidence=row.truth_confidence,
        )
        for row in rows
    ]


@router.get("/credit-brain", response_model=CreditBrainOut)
def credit_brain(
    case_id: str,
    auth: AuthContext = Depends(get_analyst_auth),
    db: Session = Depends(get_db),
) -> CreditBrainOut:
    _require_case(db, case_id, auth.org_id)

    row = db.scalar(select(CreditBrainResult).where(CreditBrainResult.case_id == case_id))
    if not row:
        result = compute_credit_brain(db, auth.org_id, case_id, persist=True)
        db.commit()
        return CreditBrainOut(**result)

    return CreditBrainOut(
        decision=row.decision,
        grade=row.grade,
        truth_score=row.truth_score,
        stress_score=row.stress_score,
        fraud_score=row.fraud_score,
        suggested_exposure_min=float(row.suggested_exposure_min),
        suggested_exposure_max=float(row.suggested_exposure_max),
        key_positives=row.key_positives,
        key_concerns=row.key_concerns,
        conditions_precedent=row.conditions_precedent,
        narrative=row.narrative,
    )
