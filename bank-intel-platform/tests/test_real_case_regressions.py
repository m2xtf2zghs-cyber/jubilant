from pathlib import Path

import pytest

from scripts.run_case_regressions import default_cases_dir, load_manifest, resolve_manual_workbook, run_manifest


def test_real_case_regressions_manifest() -> None:
    root = Path(__file__).resolve().parents[1]
    manifest_path = root / "tests" / "fixtures" / "case_regressions.json"
    db_path = root / "bank_intel.db"
    cases_dir = default_cases_dir()

    if not db_path.exists():
        pytest.skip("local regression DB is not present")

    missing = []
    for case in load_manifest(manifest_path):
        workbook = resolve_manual_workbook(cases_dir, case["manual_workbook"])
        if not workbook.exists():
            missing.append(str(workbook))

    if missing:
        pytest.skip(f"manual regression workbooks missing: {', '.join(missing)}")

    result = run_manifest(
        manifest_path=manifest_path,
        db_path=db_path,
        export_dir=root / "data" / "exports",
        cases_dir=cases_dir,
    )
    assert not result.failures, "\n".join(result.failures)
