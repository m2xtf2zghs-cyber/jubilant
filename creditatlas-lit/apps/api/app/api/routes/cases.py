from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_current_auth
from app.db.session import get_db
from app.models.entities import (
    Borrower,
    CreditBrainResult,
    EmiObligation,
    LoanCase,
    PrivateLenderSignal,
    RiskFlag,
    TruthEngineResult,
)
from app.schemas.common import CaseCreate, CaseOut, CaseSummaryOut
from app.services.audit import log_audit

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseOut)
def create_case(
    payload: CaseCreate,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> CaseOut:
    borrower = db.scalar(
        select(Borrower)
        .where(Borrower.id == payload.borrower_id)
        .where(Borrower.org_id == auth.org_id)
    )
    if not borrower:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower not found")

    case = LoanCase(
        org_id=auth.org_id,
        borrower_id=payload.borrower_id,
        analyst_user_id=auth.user.id,
        status=payload.status,
    )
    db.add(case)
    db.flush()
    log_audit(
        db,
        org_id=auth.org_id,
        user_id=auth.user.id,
        case_id=case.id,
        action="CASE_CREATED",
        entity_type="loan_case",
        entity_id=case.id,
        details={"borrower_id": payload.borrower_id, "status": payload.status},
    )
    db.commit()
    db.refresh(case)
    return CaseOut.model_validate(case)


@router.get("", response_model=list[CaseOut])
def list_cases(
    borrower_id: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> list[CaseOut]:
    query = select(LoanCase).where(LoanCase.org_id == auth.org_id).order_by(LoanCase.created_at.desc())
    if borrower_id:
        query = query.where(LoanCase.borrower_id == borrower_id)

    rows = db.scalars(query).all()
    return [CaseOut.model_validate(row) for row in rows]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> CaseOut:
    row = db.scalar(
        select(LoanCase)
        .where(LoanCase.id == case_id)
        .where(LoanCase.org_id == auth.org_id)
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return CaseOut.model_validate(row)


@router.get("/{case_id}/summary", response_model=CaseSummaryOut)
def case_summary(
    case_id: str,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
) -> CaseSummaryOut:
    case = db.scalar(select(LoanCase).where(LoanCase.id == case_id, LoanCase.org_id == auth.org_id))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    borrower = db.get(Borrower, case.borrower_id)
    latest_truth = db.scalar(
        select(TruthEngineResult)
        .where(TruthEngineResult.case_id == case_id)
        .order_by(TruthEngineResult.period_month.desc())
    )
    brain = db.scalar(select(CreditBrainResult).where(CreditBrainResult.case_id == case_id))
    flags = db.scalars(select(RiskFlag).where(RiskFlag.case_id == case_id)).all()
    emi_rows = db.scalars(select(EmiObligation).where(EmiObligation.case_id == case_id)).all()
    private_rows = db.scalars(
        select(PrivateLenderSignal).where(PrivateLenderSignal.case_id == case_id)
    ).all()

    emi_burden = sum(float(row.monthly_amount_estimate) for row in emi_rows)
    hidden_private_finance = sum(float(row.estimated_principal) for row in private_rows)
    true_sales = float(latest_truth.adjusted_business_credits) if latest_truth else 0.0
    net_surplus = max(0.0, true_sales - emi_burden - sum(float(r.estimated_monthly_interest_burden) for r in private_rows))

    kpis = {
        "true_monthly_sales": true_sales,
        "net_surplus": net_surplus,
        "emi_burden": emi_burden,
        "hidden_private_finance": hidden_private_finance,
        "truth_score": float(brain.truth_score if brain else 0),
        "fraud_risk_score": float(brain.fraud_score if brain else 0),
    }

    return CaseSummaryOut(
        case_id=case.id,
        borrower_name=borrower.name if borrower else "Unknown",
        industry=borrower.industry if borrower else None,
        constitution=borrower.constitution if borrower else None,
        months_analyzed=case.months_analyzed,
        accounts_analyzed=case.accounts_analyzed,
        decision_badge=brain.decision if brain else case.decision_badge,
        kpis=kpis,
        risk_flags=[
            {
                "code": f.code,
                "severity": f.severity,
                "title": f.title,
                "description": f.description,
                "metric_value": f.metric_value,
            }
            for f in flags
        ],
    )
