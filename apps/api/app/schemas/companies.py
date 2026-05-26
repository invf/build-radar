from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from ..models.company import CompanyRole


class CompanySchema(BaseModel):
    id: uuid.UUID
    name: str
    edrpou: Optional[str] = None
    type: Optional[CompanyRole] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    ai_score: Optional[float] = None
    objects_count: Optional[int] = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyWithRoleSchema(BaseModel):
    company: CompanySchema
    role: CompanyRole
    is_primary: bool

    model_config = {"from_attributes": True}


class CompanyDetailSchema(CompanySchema):
    updated_at: datetime
    recent_objects: list = Field(default_factory=list)
    is_favorite: bool = False


class CompanyListResponse(BaseModel):
    items: list[CompanySchema]
    total: int
    page: int
    page_size: int
    pages: int


class CompanyFilterParams(BaseModel):
    search: Optional[str] = None
    type: Optional[CompanyRole] = None
    sort_by: str = "objects_count"
    sort_order: str = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=100)
