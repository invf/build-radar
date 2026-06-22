from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any, Optional
from ..models.company import CompanyRole, RelationshipStatus


class CompanyContactSchema(BaseModel):
    name: str = ""
    position: str = ""
    phone: str = ""
    email: str = ""
    telegram: str = ""
    viber: str = ""
    notes: str = ""
    photo_url: str = ""


class CompanyProjectSchema(BaseModel):
    object_id: Optional[str] = None
    object_name: str = ""
    address: str = ""
    queue: str = ""
    deadline: str = ""
    customer: str = ""
    contractor: str = ""
    installer: str = ""
    supplier: str = ""
    designer: str = ""
    notes: str = ""
    photos: list[str] = Field(default_factory=list)
    relationship_status: Optional[RelationshipStatus] = None


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
    logo_url: Optional[str] = None
    relationship_status: Optional[RelationshipStatus] = None
    objects_count: Optional[int] = 0
    contacts: list[Any] = Field(default_factory=list)
    projects: list[Any] = Field(default_factory=list)
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


class CompanyCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    edrpou: Optional[str] = Field(None, max_length=20)
    type: Optional[CompanyRole] = None
    address: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    contacts: list[CompanyContactSchema] = Field(default_factory=list)
    projects: list[CompanyProjectSchema] = Field(default_factory=list)


class CompanyUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    edrpou: Optional[str] = Field(None, max_length=20)
    type: Optional[CompanyRole] = None
    address: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    relationship_status: Optional[RelationshipStatus] = None
    contacts: Optional[list[CompanyContactSchema]] = None
    projects: Optional[list[CompanyProjectSchema]] = None


class CompanyFilterParams(BaseModel):
    search: Optional[str] = None
    type: Optional[CompanyRole] = None
    sort_by: str = "objects_count"
    sort_order: str = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=100)
