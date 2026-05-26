from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Enum, ForeignKey, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from ..core.database import Base


class NoteStatus(str, enum.Enum):
    interesting = "interesting"
    contact_later = "contact_later"
    active_lead = "active_lead"
    in_progress = "in_progress"
    not_relevant = "not_relevant"


class ObjectNote(Base):
    __tablename__ = "object_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("construction_objects.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[Optional[NoteStatus]] = mapped_column(Enum(NoteStatus, name="note_status"))
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String(100)))
    reminder_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    construction_object = relationship("ConstructionObject", back_populates="notes")
    user = relationship("User", back_populates="notes")
