from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class PermitType(str, enum.Enum):
    construction_permit = "construction_permit"
    readiness_declaration = "readiness_declaration"
    urban_planning_conditions = "urban_planning_conditions"
    technical_conditions = "technical_conditions"
    design_approval = "design_approval"
    expert_examination = "expert_examination"


class Permit(Base):
    __tablename__ = "permits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("construction_objects.id", ondelete="CASCADE"), index=True
    )
    permit_number: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    permit_type: Mapped[PermitType] = mapped_column(
        Enum(PermitType, name="permit_type"), nullable=False
    )
    series: Mapped[Optional[str]] = mapped_column(String(20))
    issued_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    issuing_authority: Mapped[Optional[str]] = mapped_column(String(500))
    document_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    construction_object = relationship("ConstructionObject", back_populates="permits")
