from __future__ import annotations

from app.core.domain import CanonicalTransaction


class SisterConcernDetector:
    def __init__(self, sister_aliases: dict[str, str] | None = None) -> None:
        self.sister_aliases = {k.upper(): v for k, v in (sister_aliases or {}).items()}

    def tag(self, txn: CanonicalTransaction) -> None:
        party = (txn.normalized_party or "").upper()
        if party in self.sister_aliases:
            txn.sister_concern_flag = True
            txn.linked_entity = self.sister_aliases[party]
            if txn.classification_primary in {"UNKNOWN", "DOUBT"}:
                txn.classification_primary = "SIS CON"
