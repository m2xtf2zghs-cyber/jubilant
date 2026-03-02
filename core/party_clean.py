import re
from typing import Optional


def clean_party(party: Optional[str], stopwords: list[str]) -> Optional[str]:
    if not party:
        return None
    p = re.sub(r"\s+", " ", party.strip().upper())
    p = re.sub(r"[^A-Z0-9 .&()_-]", " ", p)
    p = re.sub(r"\s+", " ", p).strip()

    if p in set(sw.upper() for sw in stopwords):
        return None

    p = re.sub(r"^(?:TO|FROM|TRF|TRANSFER)\s+", "", p).strip()
    return p if p else None
