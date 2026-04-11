from __future__ import annotations

from pydantic import BaseModel, Field


class OverrideRequest(BaseModel):
    transaction_id: int
    classification_primary: str = Field(min_length=2)
    classification_secondary: str | None = None
    normalized_party: str | None = None
    analyst_notes: str | None = None


class OverrideResponse(BaseModel):
    id: int
    transaction_id: int
    classification_primary: str
    classification_secondary: str | None
    normalized_party: str | None
    analyst_notes: str | None

    model_config = {"from_attributes": True}
