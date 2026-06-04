import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from ..models.permit import PermitType


class PermitCreateSchema(BaseModel):
    object_id: uuid.UUID
    permit_number: str = Field(..., min_length=1, max_length=255)
    permit_type: PermitType
    series: Optional[str] = Field(None, max_length=20)
    issued_date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    issuing_authority: Optional[str] = Field(None, max_length=500)
    document_url: Optional[str] = None


class PermitSchema(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    permit_number: str
    permit_type: PermitType
    series: Optional[str] = None
    issued_date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    issuing_authority: Optional[str] = None
    document_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
