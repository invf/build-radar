"""Add international tender fields to tenders table

Revision ID: 009_tenders_international_fields
Revises: 008_manufacturers_orders
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "009_tenders_international_fields"
down_revision = "008_manufacturers_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenders", sa.Column("source", sa.String(50), nullable=True, server_default="prozorro"))
    op.add_column("tenders", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("tenders", sa.Column("country", sa.String(100), nullable=True))
    op.add_column("tenders", sa.Column("donor", sa.String(100), nullable=True))
    op.add_column("tenders", sa.Column("sector", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("tenders", "sector")
    op.drop_column("tenders", "donor")
    op.drop_column("tenders", "country")
    op.drop_column("tenders", "source_url")
    op.drop_column("tenders", "source")
