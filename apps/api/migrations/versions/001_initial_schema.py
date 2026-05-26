"""Initial schema — all 14 tables

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostGIS extension (Supabase already has it, safe to run)
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # ── Enums ──────────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer')
    """)
    op.execute("""
        CREATE TYPE object_status AS ENUM (
            'planned', 'approved', 'under_construction',
            'completed', 'suspended', 'cancelled'
        )
    """)
    op.execute("""
        CREATE TYPE object_category AS ENUM (
            'residential', 'commercial', 'industrial',
            'infrastructure', 'social', 'mixed'
        )
    """)
    op.execute("""
        CREATE TYPE object_type AS ENUM (
            'apartment_building', 'private_house', 'office',
            'shopping_center', 'warehouse', 'factory',
            'hospital', 'school', 'hotel', 'infrastructure', 'other'
        )
    """)
    op.execute("""
        CREATE TYPE company_role AS ENUM (
            'developer', 'general_contractor', 'subcontractor',
            'designer', 'engineering', 'technical_supervision',
            'architect', 'investor'
        )
    """)
    op.execute("""
        CREATE TYPE permit_type AS ENUM (
            'construction_permit', 'readiness_declaration',
            'urban_planning_conditions', 'technical_conditions',
            'design_approval', 'expert_examination'
        )
    """)
    op.execute("""
        CREATE TYPE tender_status AS ENUM (
            'active', 'complete', 'cancelled', 'unsuccessful'
        )
    """)
    op.execute("""
        CREATE TYPE note_status AS ENUM (
            'interesting', 'contact_later', 'active_lead',
            'in_progress', 'not_relevant'
        )
    """)
    op.execute("""
        CREATE TYPE notification_type AS ENUM (
            'new_object', 'status_change', 'new_permit',
            'new_tender', 'ai_insight', 'reminder', 'system'
        )
    """)
    op.execute("""
        CREATE TYPE parser_status AS ENUM (
            'running', 'completed', 'failed', 'scheduled'
        )
    """)

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.Enum("admin", "manager", "viewer", name="user_role"), nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("avatar_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_login", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── invitations ────────────────────────────────────────────────────────────
    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.Enum("admin", "manager", "viewer", name="user_role"), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_invitations_token", "invitations", ["token"])

    # ── construction_objects ───────────────────────────────────────────────────
    op.create_table(
        "construction_objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("address", sa.String(500)),
        sa.Column("city", sa.String(100)),
        sa.Column("oblast", sa.String(100)),
        sa.Column("district", sa.String(100)),
        sa.Column("coordinates", geoalchemy2.types.Geometry("POINT", srid=4326)),
        sa.Column("status", sa.Enum("planned", "approved", "under_construction", "completed", "suspended", "cancelled", name="object_status"), nullable=False, server_default="planned"),
        sa.Column("category", sa.Enum("residential", "commercial", "industrial", "infrastructure", "social", "mixed", name="object_category")),
        sa.Column("object_type", sa.Enum("apartment_building", "private_house", "office", "shopping_center", "warehouse", "factory", "hospital", "school", "hotel", "infrastructure", "other", name="object_type")),
        sa.Column("floors", sa.Integer),
        sa.Column("building_area", sa.Float),
        sa.Column("land_area", sa.Float),
        sa.Column("construction_stage", sa.String(255)),
        sa.Column("planned_completion", sa.DateTime(timezone=True)),
        sa.Column("description", sa.Text),
        sa.Column("photos", postgresql.ARRAY(sa.Text)),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("source_id", sa.String(255)),
        sa.Column("raw_data", postgresql.JSONB),
        sa.Column("ai_score", sa.Float),
        sa.Column("ai_summary", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_construction_objects_name", "construction_objects", ["name"])
    op.create_index("ix_construction_objects_city", "construction_objects", ["city"])
    op.create_index("ix_construction_objects_oblast", "construction_objects", ["oblast"])
    op.create_index("ix_construction_objects_status", "construction_objects", ["status"])
    op.create_index("ix_construction_objects_category", "construction_objects", ["category"])
    op.create_index("ix_construction_objects_ai_score", "construction_objects", ["ai_score"])
    op.create_index("ix_construction_objects_source", "construction_objects", ["source"])
    op.create_index("ix_construction_objects_source_id", "construction_objects", ["source_id"])
    op.execute("""
        CREATE INDEX ix_construction_objects_fts
        ON construction_objects
        USING gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(address,'') || ' ' || coalesce(city,'')))
    """)

    # ── companies ──────────────────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("edrpou", sa.String(20), unique=True),
        sa.Column("type", sa.Enum("developer", "general_contractor", "subcontractor", "designer", "engineering", "technical_supervision", "architect", "investor", name="company_role")),
        sa.Column("address", sa.String(500)),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("website", sa.String(255)),
        sa.Column("description", sa.Text),
        sa.Column("ai_score", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_edrpou", "companies", ["edrpou"])

    # ── object_companies ───────────────────────────────────────────────────────
    op.create_table(
        "object_companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.Enum("developer", "general_contractor", "subcontractor", "designer", "engineering", "technical_supervision", "architect", "investor", name="company_role"), nullable=False),
        sa.Column("is_primary", sa.Boolean, server_default="false"),
    )
    op.create_index("ix_object_companies_object_id", "object_companies", ["object_id"])
    op.create_index("ix_object_companies_company_id", "object_companies", ["company_id"])

    # ── permits ────────────────────────────────────────────────────────────────
    op.create_table(
        "permits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permit_number", sa.String(255), nullable=False),
        sa.Column("permit_type", sa.Enum("construction_permit", "readiness_declaration", "urban_planning_conditions", "technical_conditions", "design_approval", "expert_examination", name="permit_type"), nullable=False),
        sa.Column("series", sa.String(20)),
        sa.Column("issued_date", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("issuing_authority", sa.String(500)),
        sa.Column("document_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_permits_object_id", "permits", ["object_id"])
    op.create_index("ix_permits_permit_number", "permits", ["permit_number"])

    # ── tenders ────────────────────────────────────────────────────────────────
    op.create_table(
        "tenders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="SET NULL")),
        sa.Column("prozorro_id", sa.String(255), nullable=False, unique=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("status", sa.Enum("active", "complete", "cancelled", "unsuccessful", name="tender_status"), nullable=False, server_default="active"),
        sa.Column("amount", sa.Float),
        sa.Column("currency", sa.String(10), server_default="UAH"),
        sa.Column("deadline", sa.DateTime(timezone=True)),
        sa.Column("procuring_entity", sa.String(500)),
        sa.Column("procuring_entity_edrpou", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_tenders_object_id", "tenders", ["object_id"])
    op.create_index("ix_tenders_prozorro_id", "tenders", ["prozorro_id"])
    op.create_index("ix_tenders_procuring_entity_edrpou", "tenders", ["procuring_entity_edrpou"])

    # ── object_notes ───────────────────────────────────────────────────────────
    op.create_table(
        "object_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note_text", sa.Text, nullable=False),
        sa.Column("status", sa.Enum("interesting", "contact_later", "active_lead", "in_progress", "not_relevant", name="note_status")),
        sa.Column("tags", postgresql.ARRAY(sa.String(100))),
        sa.Column("reminder_date", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_object_notes_object_id", "object_notes", ["object_id"])
    op.create_index("ix_object_notes_user_id", "object_notes", ["user_id"])

    # ── saved_searches ─────────────────────────────────────────────────────────
    op.create_table(
        "saved_searches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("filters", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("notify_enabled", sa.Boolean, server_default="false"),
        sa.Column("last_checked", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_saved_searches_user_id", "saved_searches", ["user_id"])

    # ── favorite_objects ───────────────────────────────────────────────────────
    op.create_table(
        "favorite_objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_favorite_objects_user_id", "favorite_objects", ["user_id"])
    op.create_index("ix_favorite_objects_object_id", "favorite_objects", ["object_id"])

    # ── favorite_companies ─────────────────────────────────────────────────────
    op.create_table(
        "favorite_companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_favorite_companies_user_id", "favorite_companies", ["user_id"])
    op.create_index("ix_favorite_companies_company_id", "favorite_companies", ["company_id"])

    # ── ai_analyses ────────────────────────────────────────────────────────────
    op.create_table(
        "ai_analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_type", sa.String(100), server_default="opportunity_analysis"),
        sa.Column("summary", sa.Text),
        sa.Column("hvac_opportunity", sa.Float),
        sa.Column("itp_opportunity", sa.Float),
        sa.Column("engineering_complexity", sa.String(20)),
        sa.Column("estimated_budget_uah", sa.Float),
        sa.Column("opportunity_insights", postgresql.JSONB),
        sa.Column("recommended_actions", postgresql.JSONB),
        sa.Column("content", postgresql.JSONB),
        sa.Column("score", sa.Float),
        sa.Column("model_version", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_ai_analyses_object_id", "ai_analyses", ["object_id"])
    op.create_index("ix_ai_analyses_score", "ai_analyses", ["score"])

    # ── status_history ─────────────────────────────────────────────────────────
    op.create_table(
        "status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("construction_objects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("old_value", sa.Text),
        sa.Column("new_value", sa.Text, nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("source", sa.String(100), nullable=False),
    )
    op.create_index("ix_status_history_object_id", "status_history", ["object_id"])

    # ── notifications ──────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.Enum("new_object", "status_change", "new_permit", "new_tender", "ai_insight", "reminder", "system", name="notification_type")),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("related_object_id", postgresql.UUID(as_uuid=True)),
        sa.Column("related_company_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])

    # ── notification_settings ──────────────────────────────────────────────────
    op.create_table(
        "notification_settings",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("email_enabled", sa.Boolean, server_default="true"),
        sa.Column("telegram_enabled", sa.Boolean, server_default="false"),
        sa.Column("push_enabled", sa.Boolean, server_default="true"),
        sa.Column("telegram_chat_id", sa.String(100)),
        sa.Column("digest_frequency", sa.String(20), server_default="daily"),
    )

    # ── parser_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "parser_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("objects_found", sa.Integer, server_default="0"),
        sa.Column("objects_updated", sa.Integer, server_default="0"),
        sa.Column("objects_created", sa.Integer, server_default="0"),
        sa.Column("errors", postgresql.JSONB),
        sa.Column("status", sa.Enum("running", "completed", "failed", "scheduled", name="parser_status"), nullable=False, server_default="running"),
    )
    op.create_index("ix_parser_logs_source", "parser_logs", ["source"])
    op.create_index("ix_parser_logs_status", "parser_logs", ["status"])

    # ── audit_logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100)),
        sa.Column("resource_id", sa.String(255)),
        sa.Column("metadata", postgresql.JSONB),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # ── Row Level Security (RLS) ───────────────────────────────────────────────
    for table in ["object_notes", "saved_searches", "favorite_objects", "favorite_companies", "notifications", "notification_settings"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    tables = [
        "audit_logs", "parser_logs", "notification_settings", "notifications",
        "status_history", "ai_analyses", "favorite_companies", "favorite_objects",
        "saved_searches", "object_notes", "tenders", "permits",
        "object_companies", "companies", "construction_objects",
        "invitations", "users",
    ]
    for t in tables:
        op.drop_table(t)

    enums = [
        "parser_status", "notification_type", "note_status", "tender_status",
        "permit_type", "company_role", "object_type", "object_category",
        "object_status", "user_role",
    ]
    for e in enums:
        op.execute(f"DROP TYPE IF EXISTS {e}")
