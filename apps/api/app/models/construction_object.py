from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Integer, Float, DateTime, Enum,
    ForeignKey, ARRAY, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from ..core.database import Base


class ObjectStatus(str, enum.Enum):
    planned = "planned"
    approved = "approved"
    under_construction = "under_construction"
    completed = "completed"
    suspended = "suspended"
    cancelled = "cancelled"


class ObjectCategory(str, enum.Enum):
    residential = "residential"
    commercial = "commercial"
    industrial = "industrial"
    infrastructure = "infrastructure"
    social = "social"
    mixed = "mixed"


class ObjectType(str, enum.Enum):
    apartment_building = "apartment_building"
    private_house = "private_house"
    office = "office"
    shopping_center = "shopping_center"
    warehouse = "warehouse"
    factory = "factory"
    hospital = "hospital"
    school = "school"
    hotel = "hotel"
    infrastructure = "infrastructure"
    other = "other"


class ConstructionObject(Base):
    __tablename__ = "construction_objects"
    __table_args__ = (
        Index("ix_construction_objects_city", "city"),
        Index("ix_construction_objects_oblast", "oblast"),
        Index("ix_construction_objects_status", "status"),
        Index("ix_construction_objects_category", "category"),
        Index("ix_construction_objects_ai_score", "ai_score"),
        Index("ix_construction_objects_source", "source"),
        Index(
            "ix_construction_objects_fts",
            "name", "address", "city",
            postgresql_using="gin",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    oblast: Mapped[Optional[str]] = mapped_column(String(100))
    district: Mapped[Optional[str]] = mapped_column(String(100))

    # Geospatial - PostGIS Point (WGS84)
    coordinates: Mapped[Optional[object]] = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=True)
    )

    status: Mapped[ObjectStatus] = mapped_column(
        Enum(ObjectStatus, name="object_status"),
        nullable=False,
        default=ObjectStatus.planned,
        index=True,
    )
    category: Mapped[Optional[ObjectCategory]] = mapped_column(
        Enum(ObjectCategory, name="object_category")
    )
    object_type: Mapped[Optional[ObjectType]] = mapped_column(
        Enum(ObjectType, name="object_type")
    )

    floors: Mapped[Optional[int]] = mapped_column(Integer)
    building_area: Mapped[Optional[float]] = mapped_column(Float)
    land_area: Mapped[Optional[float]] = mapped_column(Float)
    construction_stage: Mapped[Optional[str]] = mapped_column(String(255))
    planned_completion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    description: Mapped[Optional[str]] = mapped_column(Text)
    photos: Mapped[Optional[list]] = mapped_column(ARRAY(Text))

    # Participants
    customer: Mapped[Optional[str]] = mapped_column(Text)
    general_contractor: Mapped[Optional[str]] = mapped_column(Text)
    designer: Mapped[Optional[str]] = mapped_column(Text)
    installer: Mapped[Optional[str]] = mapped_column(Text)

    website: Mapped[Optional[str]] = mapped_column(String(500))

    # Data source tracking
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    source_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)

    # AI fields
    ai_score: Mapped[Optional[float]] = mapped_column(Float)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    companies = relationship("ObjectCompany", back_populates="construction_object", cascade="all, delete-orphan")
    permits = relationship("Permit", back_populates="construction_object", cascade="all, delete-orphan")
    tenders = relationship("Tender", back_populates="construction_object")
    notes = relationship("ObjectNote", back_populates="construction_object", cascade="all, delete-orphan")
    favorites = relationship("FavoriteObject", back_populates="construction_object", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="construction_object", cascade="all, delete-orphan")
    ai_analyses = relationship("AIAnalysis", back_populates="construction_object", cascade="all, delete-orphan")
