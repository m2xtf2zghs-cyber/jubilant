from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    ANALYST = "ANALYST"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"


ANALYST_ROLES = {UserRole.ANALYST.value, UserRole.MANAGER.value, UserRole.ADMIN.value}
MANAGER_ROLES = {UserRole.MANAGER.value, UserRole.ADMIN.value}
