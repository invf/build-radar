from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Float, DateTime, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..core.database import Base


class CompanyRole(str, enum.Enum):
    developer = "developer"
    general_contractor = "general_contractor"
    subcontractor = "subcontractor"
    designer = "designer"
    engineering = "engineering"
    technical_supervision = "technical_supervision"
    architect = "architect"
    investor = "investor"


class RelationshipStatus(str, enum.Enum):
    active = "active"
    prospect = "prospect"
    inactive = "inactive"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    edrpou: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    type: Mapped[Optional[CompanyRole]] = mapped_column(Enum(CompanyRole, name="company_role"))
    address: Mapped[Optional[str]] = mapped_column(String(500))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    website: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    ai_score: Mapped[Optional[float]] = mapped_column(Float)
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    relationship_status: Mapped[Optional[RelationshipStatus]] = mapped_column(
        Enum(RelationshipStatus, name="relationship_status"), nullable=True
    )
    contacts: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    projects: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    object_companies = relationship("ObjectCompany", back_populates="company")
    favorites = relationship("FavoriteCompany", back_populates="company", cascade="all, delete-orphan")


class ObjectCompany(Base):
    """Junction table: construction_object ↔ company with role."""
    __tablename__ = "object_companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("construction_objects.id", ondelete="CASCADE"), index=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[CompanyRole] = mapped_column(Enum(CompanyRole, name="company_role"), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    relationship_status: Mapped[Optional[RelationshipStatus]] = mapped_column(
        Enum(RelationshipStatus, name="relationship_status"), nullable=True
    )

    # Relationships
    construction_object = relationship("ConstructionObject", back_populates="companies")
    company = relationship("Company", back_populates="object_companies")
