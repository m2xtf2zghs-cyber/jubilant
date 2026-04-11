from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import JobStatus


class JobCreateRequest(BaseModel):
    name: str = Field(default="Bank Statement Job")
    borrower_rules_yaml: str | None = None


class JobRulesRequest(BaseModel):
    borrower_rules_yaml: str | None = None


class JobRulesResponse(BaseModel):
    job_id: str
    borrower_rules_yaml: str | None
    parsed_rules: dict


class JobResponse(BaseModel):
    id: str
    name: str
    status: JobStatus
    input_count: int
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
