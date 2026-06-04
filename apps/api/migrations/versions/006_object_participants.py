"""Add participant fields to construction_objects

Revision ID: 006_object_participants
Revises: 005_obj_co_rel_status
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "006_object_participants"
down_revision = "005_obj_co_rel_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("construction_objects", sa.Column("customer", sa.Text(), nullable=True))
    op.add_column("construction_objects", sa.Column("general_contractor", sa.Text(), nullable=True))
    op.add_column("construction_objects", sa.Column("designer", sa.Text(), nullable=True))
    op.add_column("construction_objects", sa.Column("installer", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("construction_objects", "installer")
    op.drop_column("construction_objects", "designer")
    op.drop_column("construction_objects", "general_contractor")
    op.drop_column("construction_objects", "customer")
