import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class AIAnalysisSchema(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    analysis_type: str
    summary: Optional[str] = None
    hvac_opportunity: Optional[float] = None
    itp_opportunity: Optional[float] = None
    engineering_complexity: Optional[str] = None
    estimated_budget_uah: Optional[float] = None
    opportunity_insights: Optional[list[str]] = None
    recommended_actions: Optional[list[str]] = None
    score: Optional[float] = None
    model_version: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
