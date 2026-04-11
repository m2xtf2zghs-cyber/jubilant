from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx


class RemoteParseClient:
    def __init__(self, base_url: str, *, api_key: str | None = None, timeout: float = 180.0):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        return {"Authorization": f"Bearer {self.api_key}"}

    def upload_and_parse(
        self,
        files: list[Path],
        *,
        job_name: str,
        borrower_rules_yaml: str | None = None,
    ) -> dict[str, Any]:
        multipart_files = [("files", (path.name, path.read_bytes(), "application/pdf")) for path in files]
        data = {"job_name": job_name}
        if borrower_rules_yaml:
            data["borrower_rules_yaml"] = borrower_rules_yaml
        with httpx.Client(timeout=self.timeout, headers=self._headers()) as client:
            response = client.post(f"{self.base_url}/api/parse/upload", files=multipart_files, data=data)
            response.raise_for_status()
            return dict(response.json())

    def export_workbook(self, job_id: str) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout, headers=self._headers()) as client:
            response = client.post(f"{self.base_url}/api/exports/{job_id}")
            response.raise_for_status()
            return dict(response.json())

    def download_latest_export(self, job_id: str, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        with httpx.Client(timeout=self.timeout, headers=self._headers()) as client:
            response = client.get(f"{self.base_url}/api/exports/{job_id}/latest")
            response.raise_for_status()
            filename = self._extract_filename(response) or f"{job_id}.xlsx"
            target = output_dir / filename
            target.write_bytes(response.content)
            return target

    def integrity_check(self, files: list[Path]) -> list[dict[str, Any]]:
        multipart_files = [("files", (path.name, path.read_bytes(), "application/pdf")) for path in files]
        with httpx.Client(timeout=self.timeout, headers=self._headers()) as client:
            response = client.post(f"{self.base_url}/api/integrity/check", files=multipart_files)
            response.raise_for_status()
            payload = response.json()
            return list(payload)

    @staticmethod
    def _extract_filename(response: httpx.Response) -> str | None:
        content_disposition = response.headers.get("content-disposition", "")
        marker = "filename="
        if marker not in content_disposition:
            return None
        return content_disposition.split(marker, 1)[1].strip().strip('"')
