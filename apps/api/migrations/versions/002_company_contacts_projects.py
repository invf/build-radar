"""Add contacts and projects JSONB columns to companies

Revision ID: 002_company_contacts_projects
Revises: 001_initial_schema
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002_company_contacts_projects"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("contacts", JSONB, nullable=True, server_default="[]"))
    op.add_column("companies", sa.Column("projects", JSONB, nullable=True, server_default="[]"))


def downgrade() -> None:
    op.drop_column("companies", "contacts")
    op.drop_column("companies", "projects")
