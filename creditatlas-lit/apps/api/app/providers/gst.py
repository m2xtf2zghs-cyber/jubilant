from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol


@dataclass
class GSTProfileData:
    gstin: str
    legal_name: str
    registration_status: str
    filing_frequency: str
    last_filed_period: str
    gstr1_turnover: float
    gstr3b_turnover: float
    provider_name: str
    confidence: float


class GSTProvider(Protocol):
    provider_name: str

    def verify_gstin(self, gstin: str) -> dict: ...

    def fetch_gstr_summary(self, gstin: str) -> dict: ...

    def to_canonical_profile(self, verify_payload: dict, summary_payload: dict) -> GSTProfileData: ...


class ClearGSTProvider:
    provider_name = "CLEAR"

    def verify_gstin(self, gstin: str) -> dict:
        if gstin.startswith("99"):
            raise RuntimeError("Clear provider timeout")
        return {
            "gstin": gstin,
            "legal_name": f"{gstin[-6:]} TRADING PRIVATE LIMITED",
            "registration_status": "Active",
            "filing_frequency": "Monthly",
            "last_filed_period": "2026-02",
        }

    def fetch_gstr_summary(self, gstin: str) -> dict:
        base = _turnover_base(gstin)
        return {
            "gstr1_turnover": float(base),
            "gstr3b_turnover": float(base * 0.93),
        }

    def to_canonical_profile(self, verify_payload: dict, summary_payload: dict) -> GSTProfileData:
        return GSTProfileData(
            gstin=verify_payload["gstin"],
            legal_name=verify_payload["legal_name"],
            registration_status=verify_payload["registration_status"],
            filing_frequency=verify_payload["filing_frequency"],
            last_filed_period=verify_payload["last_filed_period"],
            gstr1_turnover=float(summary_payload["gstr1_turnover"]),
            gstr3b_turnover=float(summary_payload["gstr3b_turnover"]),
            provider_name=self.provider_name,
            confidence=0.9,
        )


class KarzaGSTProvider:
    provider_name = "KARZA"

    def verify_gstin(self, gstin: str) -> dict:
        return {
            "gstin": gstin,
            "legal_name": f"{gstin[-5:]} ENTERPRISES",
            "registration_status": "Active",
            "filing_frequency": "Monthly",
            "last_filed_period": "2026-02",
        }

    def fetch_gstr_summary(self, gstin: str) -> dict:
        base = _turnover_base(gstin)
        return {
            "gstr1_turnover": float(base * 0.98),
            "gstr3b_turnover": float(base * 0.91),
        }

    def to_canonical_profile(self, verify_payload: dict, summary_payload: dict) -> GSTProfileData:
        return GSTProfileData(
            gstin=verify_payload["gstin"],
            legal_name=verify_payload["legal_name"],
            registration_status=verify_payload["registration_status"],
            filing_frequency=verify_payload["filing_frequency"],
            last_filed_period=verify_payload["last_filed_period"],
            gstr1_turnover=float(summary_payload["gstr1_turnover"]),
            gstr3b_turnover=float(summary_payload["gstr3b_turnover"]),
            provider_name=self.provider_name,
            confidence=0.82,
        )


def _turnover_base(gstin: str) -> int:
    digest = hashlib.sha256(gstin.encode()).hexdigest()
    # deterministic range: 80L to 300L
    return 8_000_000 + (int(digest[:8], 16) % 22_000_000)
