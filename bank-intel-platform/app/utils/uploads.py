from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.core.settings import Settings
from app.utils.text import sanitize_filename

PDF_MAGIC = b"%PDF-"


class UploadValidationError(ValueError):
    pass


@dataclass(slots=True)
class ValidatedUpload:
    original_name: str
    safe_name: str
    content: bytes


def validate_upload_count(count: int, settings: Settings) -> None:
    if count > settings.max_files_per_job:
        raise UploadValidationError(f"too many files; maximum {settings.max_files_per_job} PDFs per job")


def validate_pdf_bytes(file_name: str, content: bytes, settings: Settings) -> ValidatedUpload:
    safe_name = sanitize_filename(file_name or "statement.pdf")
    if not safe_name.lower().endswith(".pdf"):
        raise UploadValidationError(f"{file_name or safe_name}: only PDF files are allowed")
    if not content:
        raise UploadValidationError(f"{file_name or safe_name}: file is empty")
    if len(content) > settings.max_upload_bytes:
        raise UploadValidationError(f"{file_name or safe_name}: file exceeds {settings.max_upload_mb} MB limit")
    if not content.startswith(PDF_MAGIC):
        raise UploadValidationError(f"{file_name or safe_name}: invalid PDF signature")
    return ValidatedUpload(original_name=file_name or safe_name, safe_name=safe_name, content=content)


def validate_local_pdf(path: Path, settings: Settings) -> Path:
    validate_pdf_bytes(path.name, path.read_bytes(), settings)
    return path


def prepare_upload_dir(base_dir: Path, batch_id: str) -> Path:
    target = base_dir / batch_id
    target.mkdir(parents=True, exist_ok=True)
    return target


def allocate_upload_path(upload_dir: Path, index: int, safe_name: str) -> Path:
    return upload_dir / f"{index:02d}_{safe_name}"
