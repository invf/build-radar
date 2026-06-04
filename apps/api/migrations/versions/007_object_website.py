"""Add website column to construction_objects

Revision ID: 007_object_website
Revises: 006_object_participants
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa

revision = "007_object_website"
down_revision = "006_object_participants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("construction_objects", sa.Column("website", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("construction_objects", "website")
