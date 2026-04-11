from __future__ import annotations

import re
from dataclasses import dataclass

from app.narration.cleaner import clean_narration


@dataclass
class NarrationExtract:
    inferred_party: str | None
    reference: str | None
    cheque_no: str | None


RTGS_REF_BANK_PARTY = re.compile(r"(?i)\bRTGS/([A-Z0-9]{8,40})/([A-Z]{3,8})/([^/]{2,100})")
NEFT_REF_BANK_PARTY = re.compile(r"(?i)\bNEFT/([A-Z0-9]{8,40})/([A-Z]{3,8})/([^/]{2,100})")
GENERIC_PARTY = re.compile(r"(?i)\b(?:RTGS|NEFT|IMPS|UPI)/([^/]{2,100})/")
# Fallback when parser truncates trailing ref segments (e.g. "IMPS/SRI AMBAL").
GENERIC_PARTY_NO_REF = re.compile(r"(?i)\b(?:RTGS|NEFT|IMPS|UPI)/([^/]{2,100})\s*$")
DASH_CHANNEL_PARTY = re.compile(r"(?i)\b(?:RTGS|NEFT|IMPS|CLEARING|TRANSFER)-([^/\-]{2,120})(?:[-/]|$)")
OMN_TO_PARTY = re.compile(r"(?i)\bOMN/TO\s+([^/]{2,120})")
TR_CHEPA_PARTY = re.compile(r"(?i)\bTR/CHEPA/([^/]{2,100})")
CS_CHEPA_PARTY = re.compile(r"(?i)\bCS/CHEPA/([^/]{2,100})")
EBANK_TR_FROM = re.compile(r"(?i)\bEBANK/TR\s+FROM\s+([^/]{2,120})")
EBANK_TR_TO = re.compile(r"(?i)\bEBANK/TR\s+TO\s+([^/]{2,120})")
CHQ_RE = re.compile(r"(?i)\b(?:CHQ|CHEQUE)(?:\s*NO)?[:\-/ ]*([A-Z0-9]{4,20})\b")
REF_RE = re.compile(r"\b([A-Z]{4}[A-Z0-9]{8,30}|[A-Z0-9]{10,30})\b")


def extract_narration_fields(raw: str) -> NarrationExtract:
    cleaned = clean_narration(raw)

    party: str | None = None
    m = RTGS_REF_BANK_PARTY.search(cleaned)
    if m:
        party = m.group(3).strip()
    if party is None:
        m = NEFT_REF_BANK_PARTY.search(cleaned)
        if m:
            party = m.group(3).strip()
    if party is None:
        m = GENERIC_PARTY.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = GENERIC_PARTY_NO_REF.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = DASH_CHANNEL_PARTY.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = OMN_TO_PARTY.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = TR_CHEPA_PARTY.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = CS_CHEPA_PARTY.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = EBANK_TR_FROM.search(cleaned)
        if m:
            party = m.group(1).strip()
    if party is None:
        m = EBANK_TR_TO.search(cleaned)
        if m:
            party = m.group(1).strip()

    cheque_no = None
    m = CHQ_RE.search(cleaned)
    if m:
        cheque_no = m.group(1)

    reference = None
    m = REF_RE.search(cleaned)
    if m:
        reference = m.group(1)

    return NarrationExtract(inferred_party=party, reference=reference, cheque_no=cheque_no)
