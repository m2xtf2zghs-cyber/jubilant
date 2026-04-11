from __future__ import annotations

import re


def clean_narration(raw: str) -> str:
    text = (raw or "").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text.upper()
