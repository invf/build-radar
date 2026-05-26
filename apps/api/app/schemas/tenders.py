import uuid
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from ..models.tender import TenderStatus


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
