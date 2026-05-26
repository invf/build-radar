from __future__ import annotations
import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..core.database import Base


class ParserStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"
    scheduled = "scheduled"


class ParserLog(Base):
    __tablename__ = "parser_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    objects_found: Mapped[int] = mapped_column(Integer, default=0)
    objects_updated: Mapped[int] = mapped_column(Integer, default=0)
    objects_created: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[list]] = mapped_column(JSONB)
    status: Mapped[ParserStatus] = mapped_column(
        Enum(ParserStatus, name="parser_status"),
        nullable=False,
        default=ParserStatus.running,
        index=True,
    )
