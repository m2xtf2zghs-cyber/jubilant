from app.narration.cleaner import clean_narration
from app.narration.extractor import extract_narration_fields


def test_clean_narration_upper_spaces() -> None:
    assert clean_narration("  Rtgs / abc  ") == "RTGS / ABC"


def test_extract_ref_bank_party_pattern() -> None:
    row = "RTGS/BKIDH25358558841/HDFC/RELIANCE"
    out = extract_narration_fields(row)
    assert out.inferred_party == "RELIANCE"
    assert out.reference == "BKIDH25358558841"
