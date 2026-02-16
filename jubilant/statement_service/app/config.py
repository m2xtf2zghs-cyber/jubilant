from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


SERVICE_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = SERVICE_ROOT.parent
AFFAN_TEMPLATE_NAME = "AFFAN METALS-FINAL WORKINGS- 05-02-2026.xlsx"


def _default_template_path() -> str:
    env_path = os.environ.get("PERFIOS_TEMPLATE_PATH")
    candidates = []
    if env_path:
        candidates.append(Path(env_path).expanduser())
    candidates.extend(
        [
            PROJECT_ROOT / "fixtures" / AFFAN_TEMPLATE_NAME,
            SERVICE_ROOT / "templates" / "perfios_template.xlsx",
            Path("/Users/jegannathan/Downloads") / AFFAN_TEMPLATE_NAME,
        ]
    )
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    # Fall back to the canonical template location even if it does not exist yet.
    return str((SERVICE_ROOT / "templates" / "perfios_template.xlsx").resolve())


class Settings(BaseModel):
    supabase_url: str
    supabase_service_key: str
    bucket: str = "statements"
    template_path: str = Field(default_factory=_default_template_path)


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    raise RuntimeError(f"Missing required environment variable: {name}")


settings = Settings(
    supabase_url=_required_env("SUPABASE_URL"),
    supabase_service_key=_required_env("SUPABASE_SERVICE_ROLE_KEY"),
    bucket=os.environ.get("SUPABASE_BUCKET", "statements"),
)
