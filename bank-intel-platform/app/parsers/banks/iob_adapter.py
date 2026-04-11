from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter


class IobAdapter(TokenBankAdapter):
    code = "IOB"

    def __init__(self) -> None:
        super().__init__(code="IOB", detect_tokens=("INDIAN OVERSEAS BANK", "IOB"))
