from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4


def job_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"JOB-{ts}-{uuid4().hex[:8]}"
