from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from core.canonical_models import CanonicalTransaction


@dataclass
class OverrideRow:
    txn_uid: str
    override_type: str
    override_category: str
    notes: str | None
    created_at: str


def _connect(db_path: str) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS overrides (
            txn_uid TEXT PRIMARY KEY,
            override_type TEXT NOT NULL,
            override_category TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def save_override(
    db_path: str,
    *,
    txn_uid: str,
    override_type: str,
    override_category: str,
    notes: str | None = None,
) -> None:
    conn = _connect(db_path)
    ts = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO overrides (txn_uid, override_type, override_category, notes, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(txn_uid) DO UPDATE SET
          override_type=excluded.override_type,
          override_category=excluded.override_category,
          notes=excluded.notes,
          created_at=excluded.created_at
        """,
        (txn_uid, override_type, override_category, notes, ts),
    )
    conn.commit()
    conn.close()


def load_overrides(db_path: str) -> dict[str, OverrideRow]:
    conn = _connect(db_path)
    rows = conn.execute(
        "SELECT txn_uid, override_type, override_category, notes, created_at FROM overrides"
    ).fetchall()
    conn.close()
    return {
        r[0]: OverrideRow(
            txn_uid=r[0],
            override_type=r[1],
            override_category=r[2],
            notes=r[3],
            created_at=r[4],
        )
        for r in rows
    }


def apply_overrides(transactions: list[CanonicalTransaction], overrides: dict[str, OverrideRow]) -> None:
    for txn in transactions:
        ov = overrides.get(txn.txn_uid)
        if not ov:
            continue
        txn.type_code = ov.override_type
        txn.category_clean = ov.override_category
        txn.rule_id = "MANUAL_OVERRIDE"
        txn.confidence = "HIGH"
        if "OVERRIDDEN" not in txn.flags:
            txn.flags.append("OVERRIDDEN")
        txn.override_applied = True
