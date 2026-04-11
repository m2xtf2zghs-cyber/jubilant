from __future__ import annotations

from app.core.domain import CanonicalTransaction
from app.classification.pattern_rules import apply_pattern_rules, load_pattern_rules
from app.classification.rules import classify_txn
from app.classification.signature import normalize_type_label, signature_keys


class ClassificationEngine:
    def __init__(self, config: dict | None = None) -> None:
        cfg = config or {}
        section = cfg.get("manual_overrides", {})
        self.enabled = bool(section.get("enabled", True))
        self.global_overrides: dict[str, str] = {
            str(k): normalize_type_label(str(v))
            for k, v in section.get("global", {}).items()
        }
        bank_raw = section.get("bank_scoped", {})
        self.bank_overrides: dict[str, dict[str, str]] = {}
        for bank, mapping in bank_raw.items():
            self.bank_overrides[str(bank).upper()] = {
                str(k): normalize_type_label(str(v))
                for k, v in (mapping or {}).items()
            }
        self.pattern_rules = load_pattern_rules(cfg)

    def _learned_type(self, txn: CanonicalTransaction) -> str | None:
        if not self.enabled:
            return None
        bank_map = self.bank_overrides.get((txn.source_bank or "").upper(), {})
        for key in signature_keys(txn.raw_narration or txn.cleaned_narration, txn.debit, txn.credit):
            if key in bank_map:
                return bank_map[key]
            if key in self.global_overrides:
                return self.global_overrides[key]
        return None

    def classify(
        self,
        txns: list[CanonicalTransaction],
        related_entities: set[str] | None = None,
        sister_entities: set[str] | None = None,
        party_profiles: dict[str, dict[str, float]] | None = None,
    ) -> list[CanonicalTransaction]:
        party_profiles = party_profiles or {}
        out: list[CanonicalTransaction] = []
        for txn in txns:
            party = (txn.normalized_party or txn.inferred_party or "").upper().strip()
            stats = party_profiles.get(party, {})
            learned = self._learned_type(txn)
            if not learned:
                matched = apply_pattern_rules(txn, self.pattern_rules)
                if matched is not None:
                    out.append(matched)
                    continue
            out.append(
                classify_txn(
                    txn,
                    related_entities=related_entities,
                    sister_entities=sister_entities,
                    party_stats=stats,
                    learned_type=learned,
                )
            )
        return out
