from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from typing import Any, Optional
from ..models.construction_object import ObjectStatus, ObjectCategory, ObjectType
from .companies import CompanyWithRoleSchema
from .permits import PermitSchema
from .tenders import TenderSchema
from .notes import ObjectNoteSchema
from .ai_analysis import AIAnalysisSchema


class CoordinatesSchema(BaseModel):
    lat: float
    lng: float


class StatusHistorySchema(BaseModel):
    id: uuid.UUID
    field_name: str
    old_value: Optional[str] = None
    new_value: str
    changed_at: datetime
    source: str

    model_config = {"from_attributes": True}


class ConstructionObjectListSchema(BaseModel):
    id: uuid.UUID
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    coordinates: Optional[CoordinatesSchema] = None
    status: ObjectStatus
    category: Optional[ObjectCategory] = None
    object_type: Optional[ObjectType] = None
    floors: Optional[int] = None
    building_area: Optional[float] = None
    ai_score: Optional[float] = None
    ai_summary: Optional[str] = None
    source: str
    permits: list = Field(default_factory=list)
    tenders: list = Field(default_factory=list)
    notes_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def parse_geometry(cls, data: Any) -> Any:
        if not hasattr(data, "__dict__"):
            return data
        raw = getattr(data, "coordinates", None)
        if raw is None:
            return data
        # Already a dict/CoordinatesSchema — pass through
        if isinstance(raw, (dict, CoordinatesSchema)):
            return data
        # GeoAlchemy2 WKBElement — convert via shapely
        try:
            from geoalchemy2.shape import to_shape
            point = to_shape(raw)
            object.__setattr__(data, "coordinates", {"lat": point.y, "lng": point.x})
        except Exception:
            object.__setattr__(data, "coordinates", None)
        return data


class ConstructionObjectDetailSchema(ConstructionObjectListSchema):
    land_area: Optional[float] = None
    construction_stage: Optional[str] = None
    planned_completion: Optional[datetime] = None
    description: Optional[str] = None
    photos: Optional[list[str]] = None
    district: Optional[str] = None
    source_id: Optional[str] = None
    companies: list[CompanyWithRoleSchema] = Field(default_factory=list)
    permits: list[PermitSchema] = Field(default_factory=list)
    tenders: list[TenderSchema] = Field(default_factory=list)
    status_history: list[StatusHistorySchema] = Field(default_factory=list)
    ai_analysis: Optional[AIAnalysisSchema] = None
    user_note: Optional[ObjectNoteSchema] = None
    is_favorite: bool = False


class MapPointSchema(BaseModel):
    id: uuid.UUID
    lat: float
    lng: float
    status: str
    name: str


class ObjectsFilterParams(BaseModel):
    status: Optional[list[ObjectStatus]] = None
    category: Optional[list[ObjectCategory]] = None
    city: Optional[list[str]] = None
    oblast: Optional[list[str]] = None
    search: Optional[str] = None
    min_floors: Optional[int] = None
    max_floors: Optional[int] = None
    min_area: Optional[float] = None
    max_area: Optional[float] = None
    min_ai_score: Optional[float] = None
    has_tenders: Optional[bool] = None
    has_permits: Optional[bool] = None
    source: Optional[list[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    sort_by: str = "updated_at"
    sort_order: str = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=100)


class PaginatedObjectsResponse(BaseModel):
    items: list[ConstructionObjectListSchema]
    total: int
    page: int
    page_size: int
    pages: int


class AISearchResponse(PaginatedObjectsResponse):
    intent_summary: str = ""
    parsed_filters: dict = Field(default_factory=dict)
