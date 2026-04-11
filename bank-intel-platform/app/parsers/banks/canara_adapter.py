from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter


class CanaraAdapter(TokenBankAdapter):
    code = "CANARA"

    def __init__(self) -> None:
        super().__init__(code="CANARA", detect_tokens=("CANARA BANK",))
