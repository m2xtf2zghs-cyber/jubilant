import re
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class PartyExtract:
    party: Optional[str]
    ref: Optional[str]
    channel: str
    rule: str


_WS = r"\s+"
SEP = r"[\/\-\|]"


def _clean_party(p: str) -> str:
    p = re.sub(r"\s+", " ", p.strip())
    p = re.sub(r"\b(?:IFSC|UTR|REF|TXN|ID)\b.*$", "", p).strip()
    return p


RTGS_1 = re.compile(r"(?i)\bRTGS" + SEP + r"(?P<party>[^\/]{2,60})" + SEP + r"(?P<ref>[A-Z0-9]{6,40})")
RTGS_2 = re.compile(
    r"(?i)\bI\/W" + _WS + r"RTGS(?:" + _WS + r"RTN|\b)" + SEP + r"(?P<party>[^\/]{2,60})(?:\/(?P<ref>[A-Z0-9]{6,40}))?"
)

NEFT_1 = re.compile(r"(?i)\bNEFT" + SEP + r"(?P<party>[^\/]{2,60})" + SEP + r"(?P<ref>[A-Z0-9]{6,40})")
NEFT_2 = re.compile(r"(?i)\bNEFT" + _WS + r"(?P<party>[A-Z0-9 .&]{2,60})" + _WS + r"(?P<ref>[A-Z0-9]{6,40})\b")

IMPS_1 = re.compile(
    r"(?i)\bIMPS" + SEP + r"(?P<party>[^\/]{2,60})" + SEP + r"(?P<ref>[0-9]{6,20})(?:\/(?P<bank>[A-Z]{2,8}))?(?:\/(?P<tail>[^\/]{2,60}))?"
)
IMPS_2 = re.compile(r"(?i)\bIMPS" + SEP + r"(?P<ref>[0-9]{6,20})" + SEP + r"(?P<party>[^\/]{2,60})")

UPI_1 = re.compile(r"(?i)\bUPI" + SEP + r"(?P<ref>[0-9A-Z]{8,25})" + SEP + r"(?P<party>[^\/]{2,80})")
UPI_2 = re.compile(r"(?i)\bUPI" + SEP + r"(?P<party>[^\/]{2,80})" + SEP + r"(?P<ref>[0-9A-Z]{8,25})")

TR_CHEPA = re.compile(r"(?i)\bTR" + SEP + r"CHEPA" + SEP + r"(?P<party>[^\/]{2,80})")

EBANK_TR_TO = re.compile(r"(?i)\bEBANK" + SEP + r"(?:TR" + _WS + r"TO|TRTO|TR" + SEP + r"TO)" + _WS + r"(?P<party>[^\/]{2,100})")
EBANK_TR_FROM = re.compile(r"(?i)\bEBANK" + SEP + r"(?:TR" + _WS + r"FROM|TRFROM|TR" + SEP + r"FROM)" + _WS + r"(?P<party>[^\/]{2,100})")

GENERIC_CHAN = re.compile(r"(?i)\b(?P<chan>RTGS|NEFT|IMPS|UPI)" + SEP + r"(?P<party>[^\/]{2,80})" + SEP + r"(?P<ref>[A-Z0-9]{6,40})")

LOAN_COLL = re.compile(r"(?i)\bLOAN" + _WS + r"(?:COLL\.?|COLLECTION)" + _WS + r"(?:TO|A\/C)?" + _WS + r"[-:]?\s*(?P<loan>[0-9]{8,20})")
JL_DISP = re.compile(r"(?i)\bJL" + _WS + r"DISP\b" + _WS + r"(?P<loan>[0-9]{8,20})")
BILL_ID = re.compile(r"(?i)\bBILL" + _WS + r"ID:\[(?P<bill>[A-Z0-9]+)\]:(?P<kind>PURCHASE|INTEREST" + _WS + r"INCOME" + _WS + r"A\/C)")


def extract_party(narration: str) -> PartyExtract:
    s = narration.strip()

    for rule_name, rx, channel in [
        ("RTGS_1", RTGS_1, "RTGS"),
        ("RTGS_2", RTGS_2, "RTGS"),
        ("NEFT_1", NEFT_1, "NEFT"),
        ("NEFT_2", NEFT_2, "NEFT"),
        ("IMPS_1", IMPS_1, "IMPS"),
        ("IMPS_2", IMPS_2, "IMPS"),
        ("UPI_1", UPI_1, "UPI"),
        ("UPI_2", UPI_2, "UPI"),
        ("TR_CHEPA", TR_CHEPA, "INTERNAL"),
        ("EBANK_TR_TO", EBANK_TR_TO, "INTERNAL"),
        ("EBANK_TR_FROM", EBANK_TR_FROM, "INTERNAL"),
        ("GENERIC_CHAN", GENERIC_CHAN, None),
    ]:
        m = rx.search(s)
        if m:
            party = m.groupdict().get("party")
            ref = m.groupdict().get("ref")
            ch = channel or (m.groupdict().get("chan") or "OTHER")
            return PartyExtract(party=_clean_party(party) if party else None, ref=ref, channel=ch, rule=rule_name)

    return PartyExtract(party=None, ref=None, channel="OTHER", rule="NO_MATCH")
