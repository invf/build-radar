import uuid
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from ..models.tender import TenderStatus

_STATUS_MAP = {
    "complete": TenderStatus.complete,
    "cancelled": TenderStatus.cancelled,
    "unsuccessful": TenderStatus.unsuccessful,
}


class TenderCreateSchema(BaseModel):
    object_id: Optional[uuid.UUID] = None
    prozorro_id: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1)
    status: TenderStatus = TenderStatus.active

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: object) -> object:
        if isinstance(v, str):
            return _STATUS_MAP.get(v, TenderStatus.active)
        return v
    amount: Optional[float] = None
    currency: str = "UAH"
    deadline: Optional[datetime] = None
    procuring_entity: Optional[str] = Field(None, max_length=500)
    procuring_entity_edrpou: Optional[str] = Field(None, max_length=20)
    source: Optional[str] = Field(None, max_length=50)
    source_url: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    donor: Optional[str] = Field(None, max_length=100)
    sector: Optional[str] = Field(None, max_length=100)


class TenderUpdateSchema(BaseModel):
    title: Optional[str] = None
    status: Optional[TenderStatus] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    deadline: Optional[datetime] = None
    procuring_entity: Optional[str] = Field(None, max_length=500)
    procuring_entity_edrpou: Optional[str] = Field(None, max_length=20)
    object_id: Optional[uuid.UUID] = None
    source_url: Optional[str] = None
    country: Optional[str] = Field(None, max_length=100)
    donor: Optional[str] = Field(None, max_length=100)
    sector: Optional[str] = Field(None, max_length=100)


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
    source: Optional[str] = "prozorro"
    source_url: Optional[str] = None
    country: Optional[str] = None
    donor: Optional[str] = None
    sector: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
