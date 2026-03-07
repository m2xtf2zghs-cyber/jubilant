"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-07 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "email", name="uq_users_org_email"),
    )
    op.create_index("ix_users_org_id", "users", ["org_id"])

    op.create_table(
        "borrowers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=255)),
        sa.Column("constitution", sa.String(length=120)),
        sa.Column("gstin", sa.String(length=20)),
        sa.Column("pan", sa.String(length=20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_borrowers_org_id", "borrowers", ["org_id"])

    op.create_table(
        "loan_cases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("borrower_id", sa.String(length=36), sa.ForeignKey("borrowers.id"), nullable=False),
        sa.Column("analyst_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="OPEN"),
        sa.Column("months_analyzed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accounts_analyzed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("decision_badge", sa.String(length=40), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_loan_cases_org_id", "loan_cases", ["org_id"])
    op.create_index("ix_loan_cases_borrower_id", "loan_cases", ["borrower_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=120)),
        sa.Column("size_bytes", sa.Integer()),
        sa.Column("uploaded_by", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_org_id", "documents", ["org_id"])
    op.create_index("ix_documents_case_id", "documents", ["case_id"])

    op.create_table(
        "bank_accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("bank_name", sa.String(length=255)),
        sa.Column("account_number_masked", sa.String(length=64)),
        sa.Column("ifsc", sa.String(length=20)),
        sa.Column("holder_name", sa.String(length=255)),
        sa.Column("source_vendor", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", "source_vendor", "external_id", name="uq_bank_account_external"),
    )
    op.create_index("ix_bank_accounts_org_id", "bank_accounts", ["org_id"])
    op.create_index("ix_bank_accounts_case_id", "bank_accounts", ["case_id"])

    op.create_table(
        "bank_statements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("bank_accounts.id")),
        sa.Column("source_vendor", sa.String(length=50), nullable=False),
        sa.Column("period_start", sa.Date()),
        sa.Column("period_end", sa.Date()),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("last_ingested_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_bank_statements_org_id", "bank_statements", ["org_id"])
    op.create_index("ix_bank_statements_case_id", "bank_statements", ["case_id"])

    op.create_table(
        "vendor_payloads",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("provider_name", sa.String(length=60), nullable=False),
        sa.Column("payload_type", sa.String(length=60), nullable=False),
        sa.Column("external_reference", sa.String(length=120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "case_id",
            "provider_name",
            "payload_type",
            "external_reference",
            name="uq_vendor_payload_idempotency",
        ),
    )
    op.create_index("ix_vendor_payloads_org_id", "vendor_payloads", ["org_id"])
    op.create_index("ix_vendor_payloads_case_id", "vendor_payloads", ["case_id"])

    op.create_table(
        "bank_transactions_raw",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("bank_accounts.id")),
        sa.Column("vendor_payload_id", sa.String(length=36), sa.ForeignKey("vendor_payloads.id"), nullable=False),
        sa.Column("external_txn_id", sa.String(length=120), nullable=False),
        sa.Column("txn_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date()),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("narration", sa.Text(), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2)),
        sa.Column("counterparty_name", sa.String(length=255)),
        sa.Column("mode", sa.String(length=60)),
        sa.Column("category_vendor", sa.String(length=120)),
        sa.Column("vendor_confidence", sa.Float()),
        sa.Column("source_vendor", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", "account_id", "external_txn_id", name="uq_raw_txn_external_dedupe"),
    )
    op.create_index("ix_bank_transactions_raw_org_id", "bank_transactions_raw", ["org_id"])
    op.create_index("ix_bank_transactions_raw_case_id", "bank_transactions_raw", ["case_id"])

    op.create_table(
        "counterparties",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("canonical_name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=60), nullable=False),
        sa.Column("first_seen", sa.Date()),
        sa.Column("last_seen", sa.Date()),
        sa.Column("total_credits", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_debits", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("txn_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", "canonical_name", name="uq_counterparty_canonical"),
    )
    op.create_index("ix_counterparties_org_id", "counterparties", ["org_id"])
    op.create_index("ix_counterparties_case_id", "counterparties", ["case_id"])

    op.create_table(
        "counterparty_aliases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("counterparty_id", sa.String(length=36), sa.ForeignKey("counterparties.id"), nullable=False),
        sa.Column("alias_name", sa.String(length=255), nullable=False),
        sa.Column("match_method", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", "alias_name", name="uq_counterparty_alias_name"),
    )
    op.create_index("ix_counterparty_aliases_org_id", "counterparty_aliases", ["org_id"])
    op.create_index(
        "ix_counterparty_alias_case_counterparty",
        "counterparty_aliases",
        ["case_id", "counterparty_id"],
    )

    op.create_table(
        "bank_transactions_normalized",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("account_id", sa.String(length=36), sa.ForeignKey("bank_accounts.id")),
        sa.Column("raw_txn_id", sa.String(length=36), sa.ForeignKey("bank_transactions_raw.id"), nullable=False),
        sa.Column("txn_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date()),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("narration_raw", sa.Text(), nullable=False),
        sa.Column("narration_clean", sa.Text(), nullable=False),
        sa.Column("counterparty_name", sa.String(length=255)),
        sa.Column("counterparty_id", sa.String(length=36), sa.ForeignKey("counterparties.id")),
        sa.Column("mode", sa.String(length=60)),
        sa.Column("category_vendor", sa.String(length=120)),
        sa.Column("category_internal", sa.String(length=120)),
        sa.Column("balance_after", sa.Numeric(14, 2)),
        sa.Column("source_vendor", sa.String(length=50), nullable=False),
        sa.Column("vendor_confidence", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_bank_transactions_normalized_org_id", "bank_transactions_normalized", ["org_id"])
    op.create_index("ix_bank_transactions_normalized_case_id", "bank_transactions_normalized", ["case_id"])

    op.create_table(
        "emi_obligations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("counterparty_id", sa.String(length=36), sa.ForeignKey("counterparties.id")),
        sa.Column("lender_name", sa.String(length=255), nullable=False),
        sa.Column("monthly_amount_estimate", sa.Numeric(14, 2), nullable=False),
        sa.Column("first_seen", sa.Date(), nullable=False),
        sa.Column("last_seen", sa.Date(), nullable=False),
        sa.Column("expected_day_of_month", sa.Integer(), nullable=False),
        sa.Column("delay_days_by_month", sa.JSON(), nullable=False),
        sa.Column("missed_months", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_emi_obligations_org_id", "emi_obligations", ["org_id"])
    op.create_index("ix_emi_obligations_case_id", "emi_obligations", ["case_id"])

    op.create_table(
        "private_lender_signals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("counterparty_id", sa.String(length=36), sa.ForeignKey("counterparties.id")),
        sa.Column("lender_name", sa.String(length=255), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("avg_credit_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("avg_repayment_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("avg_cycle_days", sa.Float(), nullable=False),
        sa.Column("estimated_principal", sa.Numeric(14, 2), nullable=False),
        sa.Column("estimated_monthly_interest_burden", sa.Numeric(14, 2), nullable=False),
        sa.Column("pattern_type", sa.String(length=80), nullable=False),
        sa.Column("signal_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_private_lender_signals_org_id", "private_lender_signals", ["org_id"])
    op.create_index("ix_private_lender_signals_case_id", "private_lender_signals", ["case_id"])

    op.create_table(
        "truth_engine_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("period_month", sa.String(length=7), nullable=False),
        sa.Column("gross_credits", sa.Numeric(14, 2), nullable=False),
        sa.Column("internal_transfers_excluded", sa.Numeric(14, 2), nullable=False),
        sa.Column("finance_credits_excluded", sa.Numeric(14, 2), nullable=False),
        sa.Column("other_non_business_excluded", sa.Numeric(14, 2), nullable=False),
        sa.Column("adjusted_business_credits", sa.Numeric(14, 2), nullable=False),
        sa.Column("truth_confidence", sa.Float(), nullable=False),
        sa.Column("explain_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", "period_month", name="uq_truth_case_period"),
    )
    op.create_index("ix_truth_engine_results_org_id", "truth_engine_results", ["org_id"])
    op.create_index("ix_truth_engine_results_case_id", "truth_engine_results", ["case_id"])

    op.create_table(
        "credit_brain_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False, unique=True),
        sa.Column("decision", sa.String(length=40), nullable=False),
        sa.Column("grade", sa.String(length=10), nullable=False),
        sa.Column("truth_score", sa.Float(), nullable=False),
        sa.Column("stress_score", sa.Float(), nullable=False),
        sa.Column("fraud_score", sa.Float(), nullable=False),
        sa.Column("suggested_exposure_min", sa.Numeric(14, 2), nullable=False),
        sa.Column("suggested_exposure_max", sa.Numeric(14, 2), nullable=False),
        sa.Column("key_positives", sa.JSON(), nullable=False),
        sa.Column("key_concerns", sa.JSON(), nullable=False),
        sa.Column("conditions_precedent", sa.JSON(), nullable=False),
        sa.Column("narrative", sa.Text(), nullable=False),
        sa.Column("explain_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_credit_brain_results_org_id", "credit_brain_results", ["org_id"])

    op.create_table(
        "risk_flags",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id"), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metric_value", sa.Float()),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_risk_flags_org_id", "risk_flags", ["org_id"])
    op.create_index("ix_risk_flags_case_id", "risk_flags", ["case_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id")),
        sa.Column("case_id", sa.String(length=36), sa.ForeignKey("loan_cases.id")),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=36)),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_org_id", "audit_logs", ["org_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("risk_flags")
    op.drop_table("credit_brain_results")
    op.drop_table("truth_engine_results")
    op.drop_table("private_lender_signals")
    op.drop_table("emi_obligations")
    op.drop_table("bank_transactions_normalized")
    op.drop_table("counterparty_aliases")
    op.drop_table("counterparties")
    op.drop_table("bank_transactions_raw")
    op.drop_table("vendor_payloads")
    op.drop_table("bank_statements")
    op.drop_table("bank_accounts")
    op.drop_table("documents")
    op.drop_table("loan_cases")
    op.drop_table("borrowers")
    op.drop_table("users")
    op.drop_table("organizations")
