from pathlib import Path

import fitz

from app.integrity import PdfIntegrityAnalyzer


def _make_pdf(path: Path, *, creator: str = "", producer: str = "") -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Statement page")
    doc.set_metadata(
        {
            "creator": creator,
            "producer": producer,
            "title": "Synthetic Statement",
            "author": "Codex",
        }
    )
    doc.save(path)
    doc.close()


def test_integrity_flags_generated_pdf_metadata(tmp_path: Path) -> None:
    pdf_path = tmp_path / "generated.pdf"
    _make_pdf(pdf_path, creator="Microsoft Word", producer="Adobe Acrobat")

    result = PdfIntegrityAnalyzer().analyze(str(pdf_path))

    assert result.file_name == "generated.pdf"
    assert result.page_count == 1
    assert result.text_page_count == 1
    assert result.verdict == "DIGITALLY_GENERATED_OR_EXPORTED"
    assert any(signal.code == "editing_tool_metadata" for signal in result.signals)
