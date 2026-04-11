from app.utils.config_loader import deep_merge, parse_yaml_text


def test_parse_yaml_text_returns_mapping() -> None:
    parsed = parse_yaml_text(
        """
manual_overrides:
  global:
    "RTGS/ABC PARTY|C": SALES
sister_concerns:
  map:
    VARUN FILL: VARUN FILL
"""
    )
    assert parsed["manual_overrides"]["global"]["RTGS/ABC PARTY|C"] == "SALES"
    assert parsed["sister_concerns"]["map"]["VARUN FILL"] == "VARUN FILL"


def test_deep_merge_allows_borrower_override() -> None:
    base = {
        "manual_overrides": {
            "enabled": True,
            "global": {"A": "DOUBT"},
        }
    }
    overlay = {
        "manual_overrides": {
            "global": {"B": "SALES"},
        }
    }
    merged = deep_merge(base, overlay)
    assert merged["manual_overrides"]["global"] == {"A": "DOUBT", "B": "SALES"}
