from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class TenderStatus(str, enum.Enum):
    active = "active"
    complete = "complete"
    cancelled = "cancelled"
    unsuccessful = "unsuccessful"


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("construction_objects.id", ondelete="SET NULL"), index=True
    )
    prozorro_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TenderStatus] = mapped_column(
        Enum(TenderStatus, name="tender_status"), nullable=False, default=TenderStatus.active
    )
    amount: Mapped[Optional[float]] = mapped_column(Float)
    currency: Mapped[Optional[str]] = mapped_column(String(10), default="UAH")
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    procuring_entity: Mapped[Optional[str]] = mapped_column(String(500))
    procuring_entity_edrpou: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    construction_object = relationship("ConstructionObject", back_populates="tenders")
