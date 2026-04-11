from __future__ import annotations

from pydantic import BaseModel


class ExportResponse(BaseModel):
    job_id: str
    export_id: int
    file_path: str
    status: str
