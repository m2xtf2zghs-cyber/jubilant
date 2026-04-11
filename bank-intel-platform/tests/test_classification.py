from app.classification.engine import ClassificationEngine
from app.core.domain import CanonicalTransaction
from app.classification.signature import narration_signature


def _txn(narr: str, dr: float = 0.0, cr: float = 0.0) -> CanonicalTransaction:
    return CanonicalTransaction(
        job_id="J1",
        source_file="f.pdf",
        source_bank="BOI",
        page_no=1,
        line_ref=1,
        raw_narration=narr,
        cleaned_narration=narr.upper(),
        debit=dr,
        credit=cr,
        month_key="JAN(26)",
    )


def test_classify_return() -> None:
    engine = ClassificationEngine()
    out = engine.classify([_txn("INW CHQ RET CHARGE", dr=1000)])[0]
    assert out.classification_primary == "RETURN"


def test_classify_bank_fin() -> None:
    engine = ClassificationEngine()
    out = engine.classify([_txn("LOAN COLL TO 1234", dr=5000)])[0]
    assert out.classification_primary == "BANK FIN"


def test_transfer_to_sister_concern_starts_unmatched() -> None:
    engine = ClassificationEngine()
    out = engine.classify(
        [_txn("TR/CHEPA/AFFAN METALS", dr=200000).model_copy(update={"normalized_party": "AFFAN METALS"})],
        related_entities={"AISHWARYA TRANSPORT"},
        sister_entities={"AFFAN METALS"},
    )[0]
    assert out.classification_primary == "UNMATCH SIS CON"


def test_salary_keywords_map_to_names() -> None:
    engine = ClassificationEngine()
    out = engine.classify([_txn("NEFT/DRIVER SALARY", dr=12000)])[0]
    assert out.classification_primary == "NAMES"


def test_learned_override_applies_before_fallback() -> None:
    sig = narration_signature("RTGS/ABC PARTY/HDFCR52025080196730628")
    engine = ClassificationEngine(
        {
            "manual_overrides": {
                "enabled": True,
                "global": {sig: "SALES"},
                "bank_scoped": {},
            }
        }
    )
    out = engine.classify([_txn("RTGS/ABC PARTY/HDFCR52025080196730628", dr=0, cr=250000)])[0]
    assert out.classification_primary == "SALES"
