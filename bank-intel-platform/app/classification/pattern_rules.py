from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.domain import CanonicalTransaction


@dataclass
class PatternRule:
    type_label: str
    pattern: str
    label: str | None = None
    mode: str = "contains"
    secondary: str | None = None

    def matches(self, narration: str) -> bool:
        haystack = narration or ""
        if self.mode == "regex":
            return re.search(self.pattern, haystack, re.IGNORECASE) is not None
        return self.pattern.upper() in haystack.upper()


def _normalize_entries(raw: object) -> list[dict]:
    if isinstance(raw, dict):
        return [{"pattern": str(pattern), "label": str(label)} for pattern, label in raw.items()]
    if isinstance(raw, list):
        out: list[dict] = []
        for item in raw:
            if isinstance(item, str):
                out.append({"pattern": item, "label": item})
            elif isinstance(item, dict):
                out.append(item)
        return out
    return []


def load_pattern_rules(cfg: dict | None) -> list[PatternRule]:
    cfg = cfg or {}
    rules_cfg = cfg.get("rules_engine", {}) if isinstance(cfg.get("rules_engine", {}), dict) else {}
    sections = {
        "sales_patterns": "SALES",
        "purchase_patterns": "PURCHASE",
        "expense_patterns": "EXPENSE",
        "bank_fin_patterns": "BANK FIN",
        "names_patterns": "NAMES",
        "insurance_patterns": "INSURANCE",
        "prop_patterns": "PROP",
        "reversal_patterns": "REVERSAL",
    }

    out: list[PatternRule] = []
    for key, type_label in sections.items():
        merged_entries = []
        merged_entries.extend(_normalize_entries(cfg.get(key)))
        merged_entries.extend(_normalize_entries(rules_cfg.get(key)))
        for entry in merged_entries:
            pattern = str(entry.get("pattern") or entry.get("match") or "").strip()
            if not pattern:
                continue
            out.append(
                PatternRule(
                    type_label=type_label,
                    pattern=pattern,
                    label=str(entry.get("label")).strip() if entry.get("label") is not None else None,
                    mode=str(entry.get("mode") or "contains").strip().lower(),
                    secondary=str(entry.get("secondary")).strip() if entry.get("secondary") is not None else None,
                )
            )
    return out


def apply_pattern_rules(txn: CanonicalTransaction, rules: list[PatternRule]) -> CanonicalTransaction | None:
    narration = txn.cleaned_narration or txn.raw_narration or ""
    for rule in rules:
        if not rule.matches(narration):
            continue
        txn.classification_primary = rule.type_label
        if rule.label:
            txn.normalized_party = rule.label.upper()
        if rule.secondary:
            txn.classification_secondary = rule.secondary
        if rule.type_label == "BANK FIN":
            txn.bank_fin_flag = True
        elif rule.type_label == "INSURANCE":
            txn.classification_secondary = txn.classification_secondary or "INSURANCE"
        elif rule.type_label == "REVERSAL":
            txn.return_flag = False
        txn.confidence_score = max(txn.confidence_score, 0.94)
        return txn
    return None
