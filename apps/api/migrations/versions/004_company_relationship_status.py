"""Add relationship_status column to companies

Revision ID: 004_company_relationship_status
Revises: 003_company_logo
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004_company_relationship_status"
down_revision = "003_company_logo"
branch_labels = None
depends_on = None

relationship_status_enum = postgresql.ENUM(
    "active", "prospect", "inactive",
    name="relationship_status",
    create_type=False,
)


def upgrade() -> None:
    relationship_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "companies",
        sa.Column(
            "relationship_status",
            sa.Enum("active", "prospect", "inactive", name="relationship_status"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("companies", "relationship_status")
    op.execute("DROP TYPE IF EXISTS relationship_status")
