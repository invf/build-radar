import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from ..models.tender import TenderStatus


class TenderCreateSchema(BaseModel):
    object_id: Optional[uuid.UUID] = None
    prozorro_id: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1)
    status: TenderStatus = TenderStatus.active
    amount: Optional[float] = None
    currency: str = "UAH"
    deadline: Optional[datetime] = None
    procuring_entity: Optional[str] = Field(None, max_length=500)
    procuring_entity_edrpou: Optional[str] = Field(None, max_length=20)


class TenderSchema(BaseModel):
    id: uuid.UUID
    object_id: Optional[uuid.UUID] = None
    prozorro_id: str
    title: str
    status: TenderStatus
    amount: Optional[float] = None
    currency: Optional[str] = "UAH"
    deadline: Optional[datetime] = None
    procuring_entity: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
