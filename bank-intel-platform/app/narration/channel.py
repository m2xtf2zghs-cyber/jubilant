from __future__ import annotations

from app.utils.text import upper_clean


def infer_channel(cleaned_narration: str, config: dict) -> str:
    n = upper_clean(cleaned_narration)
    keywords = config.get("narration", {}).get("channel_keywords", {})
    for channel, words in keywords.items():
        for token in words:
            if token.upper() in n:
                return channel
    return "OTHER"


def infer_purpose(cleaned_narration: str, config: dict) -> str:
    n = upper_clean(cleaned_narration)
    keywords = config.get("narration", {}).get("purpose_keywords", {})
    for purpose, words in keywords.items():
        for token in words:
            if token.upper() in n:
                return purpose
    return "GENERAL"
