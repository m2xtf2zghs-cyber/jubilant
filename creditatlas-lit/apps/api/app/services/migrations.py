from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, text

from alembic.config import Config
from alembic.script import ScriptDirectory
from app.core.config import settings
from app.db.session import engine


class MigrationMismatchError(RuntimeError):
    pass


def ensure_schema_up_to_date() -> None:
    if not settings.enforce_migration_check:
        return

    with engine.connect() as conn:
        db_inspector = inspect(conn)
        if not db_inspector.has_table("alembic_version"):
            raise MigrationMismatchError("alembic_version table not found. Run `alembic upgrade head`.")

        current = conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar_one_or_none()

    if current is None:
        raise MigrationMismatchError("Database migration version missing. Run `alembic upgrade head`.")

    project_root = Path(__file__).resolve().parents[2]
    alembic_cfg = Config(str(project_root / "alembic.ini"))
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = set(script.get_heads())

    if current not in heads:
        head_csv = ", ".join(sorted(heads))
        raise MigrationMismatchError(
            f"Database at revision {current}, expected one of [{head_csv}]. Run `alembic upgrade head`."
        )
