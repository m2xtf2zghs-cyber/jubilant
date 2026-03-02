from core.amount_date_parsers import infer_dr_cr, parse_amount, parse_date


def test_parse_amount_indian_and_parentheses():
    assert parse_amount("1,00,000") == 100000.0
    assert parse_amount("(1,00,000)") == -100000.0
    assert parse_amount("-1,00,000") == -100000.0


def test_parse_date_common_formats():
    assert parse_date("01/02/2026").isoformat() == "2026-02-01"
    assert parse_date("01-02-2026").isoformat() == "2026-02-01"


def test_infer_dr_cr_for_separate_columns():
    assert infer_dr_cr("1,000", None) == (1000.0, 0.0)
    assert infer_dr_cr(None, "2,500") == (0.0, 2500.0)
