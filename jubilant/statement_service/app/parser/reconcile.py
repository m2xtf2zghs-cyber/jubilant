from __future__ import annotations

from typing import Set


def reconcile_strict(raw_lines, mapped_raw_indices: Set[int]) -> int:
    """
    Count TRANSACTION rows that were not mapped to normalized transactions.
    Parsing must fail when this is non-zero.
    """
    unmapped = 0
    for index, raw_line in enumerate(raw_lines):
        if raw_line.line_type == "TRANSACTION" and index not in mapped_raw_indices:
            unmapped += 1
    return unmapped
