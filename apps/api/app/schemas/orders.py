import uuid
from datetime import datetime
from datetime import date as DateType
from typing import Optional
from pydantic import BaseModel, ConfigDict
from ..models.order import OrderStatus


class OrderBase(BaseModel):
    date: Optional[DateType] = None
    customer: Optional[str] = None
    object_name: Optional[str] = None
    address: Optional[str] = None
    equipment_count: Optional[str] = None
    manufacturer: Optional[str] = None
    production_date: Optional[DateType] = None
    notes: Optional[str] = None
    status: OrderStatus = OrderStatus.in_progress
    lat: Optional[float] = None
    lng: Optional[float] = None


class OrderCreate(OrderBase):
    pass


class OrderUpdate(BaseModel):
    date: Optional[DateType] = None
    customer: Optional[str] = None
    object_name: Optional[str] = None
    address: Optional[str] = None
    equipment_count: Optional[str] = None
    manufacturer: Optional[str] = None
    production_date: Optional[DateType] = None
    notes: Optional[str] = None
    status: Optional[OrderStatus] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class OrderOut(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
