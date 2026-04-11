from __future__ import annotations

from app.parsers.banks.token_adapter import TokenBankAdapter


class YesAdapter(TokenBankAdapter):
    code = "YES"

    def __init__(self) -> None:
        super().__init__(code="YES", detect_tokens=("YES BANK",))
