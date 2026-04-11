from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.models.parse_exception import ParseException
from app.models.transaction import Transaction
from app.schemas.job import JobCreateRequest, JobResponse, JobRulesRequest, JobRulesResponse
from app.schemas.parse import AccountSummary, ParseExceptionResponse, ParsedTransactionResponse
from app.services.job_service import JobService
from app.utils.config_loader import parse_yaml_text

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse)
def create_empty_job(payload: JobCreateRequest, db: Session = Depends(db_session)) -> JobResponse:
    job = JobService(db).create_job(payload.name, files=[], notes=payload.borrower_rules_yaml)
    return JobResponse.model_validate(job)


@router.get("", response_model=list[JobResponse])
def list_jobs(db: Session = Depends(db_session)) -> list[JobResponse]:
    jobs = JobService(db).list_jobs()
    return [JobResponse.model_validate(j) for j in jobs]


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(db_session)) -> JobResponse:
    job = JobService(db).get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return JobResponse.model_validate(job)


@router.get("/{job_id}/rules", response_model=JobRulesResponse)
def get_job_rules(job_id: str, db: Session = Depends(db_session)) -> JobRulesResponse:
    job = JobService(db).get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return JobRulesResponse(
        job_id=job.id,
        borrower_rules_yaml=job.notes,
        parsed_rules=parse_yaml_text(job.notes),
    )


@router.put("/{job_id}/rules", response_model=JobRulesResponse)
def update_job_rules(job_id: str, payload: JobRulesRequest, db: Session = Depends(db_session)) -> JobRulesResponse:
    service = JobService(db)
    job = service.update_notes(job_id, payload.borrower_rules_yaml)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return JobRulesResponse(
        job_id=job.id,
        borrower_rules_yaml=job.notes,
        parsed_rules=parse_yaml_text(job.notes),
    )


@router.get("/{job_id}/transactions", response_model=list[ParsedTransactionResponse])
def list_transactions(job_id: str, db: Session = Depends(db_session)) -> list[ParsedTransactionResponse]:
    txns = db.query(Transaction).filter(Transaction.job_id == job_id).order_by(Transaction.id.asc()).all()
    return [ParsedTransactionResponse.model_validate(t) for t in txns]


@router.get("/{job_id}/exceptions", response_model=list[ParseExceptionResponse])
def list_exceptions(job_id: str, db: Session = Depends(db_session)) -> list[ParseExceptionResponse]:
    rows = db.query(ParseException).filter(ParseException.job_id == job_id).order_by(ParseException.id.asc()).all()
    return [ParseExceptionResponse.model_validate(e) for e in rows]


@router.get("/{job_id}/accounts/summary", response_model=list[AccountSummary])
def account_summary(job_id: str, db: Session = Depends(db_session)) -> list[AccountSummary]:
    txns = db.query(Transaction).filter(Transaction.job_id == job_id).all()
    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for t in txns:
        key = t.account.account_key if t.account else f"{t.source_bank}-UNKNOWN"
        grouped[key].append(t)

    out: list[AccountSummary] = []
    for acc, rows in grouped.items():
        out.append(
            AccountSummary(
                account_key=acc,
                source_bank=rows[0].source_bank,
                source_account_no=rows[0].source_account_no,
                source_account_name=rows[0].source_account_name,
                source_account_type=rows[0].source_account_type,
                txn_count=len(rows),
                debit_total=round(sum(r.debit for r in rows), 2),
                credit_total=round(sum(r.credit for r in rows), 2),
            )
        )
    return out
