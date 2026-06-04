"""Add manufacturers and orders tables

Revision ID: 008_manufacturers_orders
Revises: 007_object_website
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_manufacturers_orders"
down_revision = "007_object_website"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "manufacturers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_manufacturers_name", "manufacturers", ["name"])

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date, nullable=True),
        sa.Column("customer", sa.String(500), nullable=True),
        sa.Column("object_name", sa.String(500), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("equipment_count", sa.String(50), nullable=True),
        sa.Column("manufacturer", sa.String(500), nullable=True),
        sa.Column("production_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "status",
            sa.Enum("in_progress", "planned", "completed", name="order_status"),
            nullable=False,
            server_default="in_progress",
        ),
        sa.Column("lat", sa.Float, nullable=True),
        sa.Column("lng", sa.Float, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("orders")
    op.drop_index("ix_manufacturers_name", "manufacturers")
    op.drop_table("manufacturers")
    op.execute("DROP TYPE IF EXISTS order_status")
