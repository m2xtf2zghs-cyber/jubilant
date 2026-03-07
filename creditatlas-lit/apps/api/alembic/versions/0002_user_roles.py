"""add user role column

Revision ID: 0002_user_roles
Revises: 0001_initial
Create Date: 2026-03-07 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_user_roles"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="ANALYST"))
    op.execute("UPDATE users SET role = 'ANALYST' WHERE role IS NULL")


def downgrade() -> None:
    op.drop_column("users", "role")
