from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from sqlalchemy.orm import Session

from app.classification.engine import ClassificationEngine
from app.core.domain import CanonicalTransaction
from app.detection.doubt import DoubtDetector
from app.detection.odd_figure import OddFigureDetector
from app.detection.private_fin import PrivateFinanceDetector
from app.detection.return_detector import ReturnDetector
from app.detection.sister_concern import SisterConcernDetector
from app.detection.transfer_reconciler import TransferReconciler
from app.entity_resolution.resolver import EntityResolver
from app.models.account import Account
from app.models.enums import FileStatus, JobStatus
from app.models.job import Job
from app.models.parse_exception import ParseException
from app.models.source_file import SourceFile
from app.models.transaction import Transaction
from app.parsers.bank_registry import BankParserRegistry
from app.parsers.generic.pdf_text_service import PdfTextExtractionService
from app.services.normalizer import TransactionNormalizer
from app.utils.config_loader import deep_merge, load_config, parse_yaml_text


class ParsingService:
    def __init__(self, db: Session, config_dir: Path):
        self.db = db
        self.base_config = load_config(config_dir)
        self.extractor = PdfTextExtractionService()
        self.registry = BankParserRegistry()
        self.config_dir = config_dir

    def parse_job(self, job_id: str) -> Job:
        job = self.db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise ValueError(f"job {job_id} not found")

        config = deep_merge(self.base_config, parse_yaml_text(job.notes))
        normalizer = TransactionNormalizer(config)
        classifier = ClassificationEngine(config)

        job.status = JobStatus.PROCESSING
        self.db.flush()

        files = self.db.query(SourceFile).filter(SourceFile.job_id == job_id).all()
        all_txns: list[CanonicalTransaction] = []

        for sf in files:
            try:
                doc = self.extractor.extract(sf.stored_path)
                adapter = self.registry.pick(doc, config)
                parsed = adapter.parse(doc, config)
                parsed.metadata.source_bank = parsed.metadata.source_bank or adapter.code

                txns = normalizer.normalize(job_id=job_id, parsed=parsed)
                all_txns.extend(txns)
                sf.status = FileStatus.PARSED
                sf.source_bank = parsed.metadata.source_bank
                sf.page_count = len(doc.pages)
            except Exception as exc:  # noqa: BLE001
                sf.status = FileStatus.FAILED
                self.db.add(
                    ParseException(
                        job_id=job_id,
                        source_file=sf.stored_path,
                        severity="FAIL",
                        code="PARSE_FILE_FAILED",
                        message=str(exc),
                    )
                )

        # classification + detection
        related_entities = {
            (t.source_account_name or "").strip().upper()
            for t in all_txns
            if (t.source_account_name or "").strip()
        }
        sister_map = config.get("sister_concerns", {}).get("map", {})
        sister_entities = {str(k).upper() for k in sister_map.keys()}

        party_profiles: dict[str, dict[str, float]] = defaultdict(
            lambda: {"credit_count": 0.0, "debit_count": 0.0, "credit_sum": 0.0, "debit_sum": 0.0}
        )
        for t in all_txns:
            party = (t.normalized_party or t.inferred_party or "").strip().upper()
            if not party:
                continue
            if t.credit > 0:
                party_profiles[party]["credit_count"] += 1
                party_profiles[party]["credit_sum"] += t.credit
            if t.debit > 0:
                party_profiles[party]["debit_count"] += 1
                party_profiles[party]["debit_sum"] += t.debit

        all_txns = classifier.classify(
            all_txns,
            related_entities=related_entities,
            sister_entities=sister_entities,
            party_profiles=party_profiles,
        )
        resolver = EntityResolver(self.db)
        for txn in all_txns:
            txn.normalized_party = resolver.resolve(txn.normalized_party or txn.inferred_party)

        sister_aliases = sister_map
        sis_detector = SisterConcernDetector(sister_aliases=sister_aliases)
        odd_detector = OddFigureDetector()
        ret_detector = ReturnDetector()
        doubt_detector = DoubtDetector()
        transfer_reconciler = TransferReconciler()

        transfer_reconciler.tag(all_txns)
        PrivateFinanceDetector().tag(all_txns)
        for txn in all_txns:
            sis_detector.tag(txn)
            odd_detector.tag(txn)
            ret_detector.tag(txn)
            doubt_detector.tag(txn)

        self._persist_transactions(job_id, all_txns)

        if self.db.query(ParseException).filter(ParseException.job_id == job_id, ParseException.severity == "FAIL").count() > 0:
            job.status = JobStatus.FAILED
        else:
            job.status = JobStatus.PARSED
        self.db.commit()
        self.db.refresh(job)
        return job

    def _persist_transactions(self, job_id: str, txns: list[CanonicalTransaction]) -> None:
        # Re-parse replaces prior derived rows for determinism.
        self.db.query(Transaction).filter(Transaction.job_id == job_id).delete()
        self.db.query(Account).filter(Account.job_id == job_id).delete()
        self.db.flush()

        # rebuild account map per parse run
        account_by_key: dict[str, Account] = {}
        order_by_account: dict[str, int] = {}

        for txn in txns:
            account_no = txn.source_account_no or "UNKNOWN"
            account_type = txn.source_account_type or "NA"
            acc_key = f"{txn.source_bank}-{account_no[-5:]}-{account_type}"
            if acc_key not in account_by_key:
                acc = (
                    self.db.query(Account)
                    .filter(Account.job_id == job_id, Account.account_key == acc_key)
                    .first()
                )
                if acc is None:
                    acc = Account(
                        job_id=job_id,
                        account_key=acc_key,
                        source_bank=txn.source_bank,
                        source_account_no=txn.source_account_no,
                        source_account_name=txn.source_account_name,
                        source_account_type=txn.source_account_type,
                    )
                    self.db.add(acc)
                    self.db.flush()
                account_by_key[acc_key] = acc
                order_by_account[acc_key] = 0

            order_by_account[acc_key] += 1
            acc_id = account_by_key[acc_key].id
            self.db.add(
                Transaction(
                    job_id=job_id,
                    account_id=acc_id,
                    source_file=txn.source_file,
                    source_bank=txn.source_bank,
                    source_account_no=txn.source_account_no,
                    source_account_name=txn.source_account_name,
                    source_account_type=txn.source_account_type,
                    page_no=txn.page_no,
                    line_ref=txn.line_ref,
                    txn_order=order_by_account[acc_key],
                    txn_date=txn.txn_date,
                    value_date=txn.value_date,
                    cheque_no=txn.cheque_no,
                    raw_narration=txn.raw_narration,
                    cleaned_narration=txn.cleaned_narration,
                    debit=txn.debit,
                    credit=txn.credit,
                    balance=txn.balance,
                    direction=txn.direction,
                    month_key=txn.month_key,
                    inferred_party=txn.inferred_party,
                    normalized_party=txn.normalized_party,
                    counterparty_type=txn.counterparty_type,
                    txn_channel=txn.txn_channel,
                    txn_purpose=txn.txn_purpose,
                    classification_primary=txn.classification_primary,
                    classification_secondary=txn.classification_secondary,
                    confidence_score=txn.confidence_score,
                    bank_fin_flag=txn.bank_fin_flag,
                    private_fin_flag=txn.private_fin_flag,
                    return_flag=txn.return_flag,
                    doubt_flag=txn.doubt_flag,
                    odd_figure_flag=txn.odd_figure_flag,
                    sister_concern_flag=txn.sister_concern_flag,
                    linked_entity=txn.linked_entity,
                    linked_loan_account=txn.linked_loan_account,
                    expected_cycle_date=txn.expected_cycle_date,
                    actual_cycle_date=txn.actual_cycle_date,
                    delay_days=txn.delay_days,
                    parse_notes=txn.parse_notes,
                    analyst_notes=txn.analyst_notes,
                    overridden_by_user=txn.overridden_by_user,
                )
            )
