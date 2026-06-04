"""Add relationship_status to object_companies

Revision ID: 005_object_company_relationship_status
Revises: 004_company_relationship_status
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "005_obj_co_rel_status"
down_revision = "004_company_relationship_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "object_companies",
        sa.Column(
            "relationship_status",
            sa.Enum("active", "prospect", "inactive", name="relationship_status"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("object_companies", "relationship_status")
