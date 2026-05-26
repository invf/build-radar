from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from ..core.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("construction_objects.id", ondelete="CASCADE"), index=True
    )
    analysis_type: Mapped[str] = mapped_column(String(100), default="opportunity_analysis")

    # Structured AI output
    summary: Mapped[Optional[str]] = mapped_column(Text)
    hvac_opportunity: Mapped[Optional[float]] = mapped_column(Float)
    itp_opportunity: Mapped[Optional[float]] = mapped_column(Float)
    engineering_complexity: Mapped[Optional[str]] = mapped_column(String(20))
    estimated_budget_uah: Mapped[Optional[float]] = mapped_column(Float)
    opportunity_insights: Mapped[Optional[list]] = mapped_column(JSONB)
    recommended_actions: Mapped[Optional[list]] = mapped_column(JSONB)

    # Full raw response
    content: Mapped[Optional[dict]] = mapped_column(JSONB)
    score: Mapped[Optional[float]] = mapped_column(Float, index=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    construction_object = relationship("ConstructionObject", back_populates="ai_analyses")
