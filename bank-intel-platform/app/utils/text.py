from __future__ import annotations

import re


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def upper_clean(value: str) -> str:
    return normalize_space(value).upper()


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return cleaned.strip("._") or "upload.pdf"
