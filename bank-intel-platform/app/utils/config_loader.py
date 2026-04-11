from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


def deep_merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def parse_yaml_text(raw: str | None) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    data = yaml.safe_load(raw) or {}
    if not isinstance(data, dict):
        return {}
    return data


def load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        return {}
    extends = data.get("extends")
    if isinstance(extends, str):
        ext = (path.parent / extends).resolve() if not extends.startswith("/") else Path(extends)
        parent = load_yaml(ext)
        data = deep_merge(parent, {k: v for k, v in data.items() if k != "extends"})
    return data


def load_config(config_dir: Path) -> dict[str, Any]:
    base = load_yaml(config_dir / "default.yaml")
    banks = load_yaml(config_dir / "bank_patterns.yaml")
    learned = load_yaml(config_dir / "manual_overrides.yaml")
    return deep_merge(deep_merge(base, banks), learned)
