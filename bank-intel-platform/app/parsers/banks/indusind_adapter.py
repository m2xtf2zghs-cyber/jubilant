from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter


class IndusindAdapter(TokenBankAdapter):
    code = "INDUSIND"

    def __init__(self) -> None:
        super().__init__(code="INDUSIND", detect_tokens=("INDUSIND BANK",))
