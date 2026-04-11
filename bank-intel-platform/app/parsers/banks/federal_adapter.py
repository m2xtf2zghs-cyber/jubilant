from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter


class FederalAdapter(TokenBankAdapter):
    code = "FEDERAL"

    def __init__(self) -> None:
        super().__init__(code="FEDERAL", detect_tokens=("FEDERAL BANK",))
