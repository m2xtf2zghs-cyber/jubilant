from __future__ import annotations

import pytest

from app.core.config import settings
from app.services.migrations import MigrationMismatchError, ensure_schema_up_to_date


def test_migration_guard_raises_without_alembic_version(monkeypatch) -> None:
    monkeypatch.setattr(settings, "enforce_migration_check", True)
    with pytest.raises(MigrationMismatchError):
        ensure_schema_up_to_date()
