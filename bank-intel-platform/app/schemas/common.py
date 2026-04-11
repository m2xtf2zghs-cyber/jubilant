from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class Timestamped(BaseModel):
    created_at: datetime
    updated_at: datetime
