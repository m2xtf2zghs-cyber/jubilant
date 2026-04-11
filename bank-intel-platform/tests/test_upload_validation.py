from pathlib import Path

import pytest

from app.core.settings import Settings
from app.utils.uploads import UploadValidationError, validate_local_pdf, validate_pdf_bytes, validate_upload_count


def _settings() -> Settings:
    return Settings(max_upload_mb=1, max_files_per_job=2)


def test_validate_pdf_bytes_accepts_pdf_signature() -> None:
    validated = validate_pdf_bytes("statement.pdf", b"%PDF-1.7\n1 0 obj\n", _settings())

    assert validated.safe_name == "statement.pdf"
    assert validated.original_name == "statement.pdf"


def test_validate_pdf_bytes_rejects_non_pdf_extension() -> None:
    with pytest.raises(UploadValidationError, match="only PDF files are allowed"):
        validate_pdf_bytes("statement.txt", b"%PDF-1.7\n1 0 obj\n", _settings())


def test_validate_pdf_bytes_rejects_invalid_signature() -> None:
    with pytest.raises(UploadValidationError, match="invalid PDF signature"):
        validate_pdf_bytes("statement.pdf", b"NOT_A_PDF", _settings())


def test_validate_upload_count_rejects_large_batch() -> None:
    with pytest.raises(UploadValidationError, match="maximum 2 PDFs per job"):
        validate_upload_count(3, _settings())


def test_validate_local_pdf_rejects_oversized_file(tmp_path: Path) -> None:
    file_path = tmp_path / "oversize.pdf"
    file_path.write_bytes(b"%PDF-" + (b"x" * (1024 * 1024)))

    with pytest.raises(UploadValidationError, match="exceeds 1 MB limit"):
        validate_local_pdf(file_path, _settings())
