"""add gst profiles

Revision ID: 0003_gst_profiles
Revises: 0002_user_roles
Create Date: 2026-03-07 15:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003_gst_profiles"
down_revision: Union[str, None] = "0002_user_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gst_profiles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("source_vendor_payload_id", sa.String(length=36), sa.ForeignKey("vendor_payloads.id"), nullable=True),
        sa.Column("provider_name", sa.String(length=60), nullable=False),
        sa.Column("gstin", sa.String(length=20), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("registration_status", sa.String(length=40), nullable=False),
        sa.Column("filing_frequency", sa.String(length=40), nullable=True),
        sa.Column("last_filed_period", sa.String(length=7), nullable=True),
        sa.Column("gstr1_turnover", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("gstr3b_turnover", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("canonical_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", name="uq_gst_profile_case"),
    )
    op.create_index("ix_gst_profiles_org_id", "gst_profiles", ["org_id"])
    op.create_index("ix_gst_profiles_case_id", "gst_profiles", ["case_id"])
    op.create_index("ix_gst_profiles_source_vendor_payload_id", "gst_profiles", ["source_vendor_payload_id"])


def downgrade() -> None:
    op.drop_index("ix_gst_profiles_source_vendor_payload_id", table_name="gst_profiles")
    op.drop_index("ix_gst_profiles_case_id", table_name="gst_profiles")
    op.drop_index("ix_gst_profiles_org_id", table_name="gst_profiles")
    op.drop_table("gst_profiles")
