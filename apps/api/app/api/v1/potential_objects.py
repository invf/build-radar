"""Potential sales objects — planned/approved DB objects that have no tenders yet."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...models.user import User
from ...models.construction_object import ConstructionObject
from ...models.tender import Tender

router = APIRouter(prefix="/potential-objects", tags=["potential-objects"])

_HIGH_TYPES = {"apartment_building", "hospital", "shopping_center", "factory"}
_MEDIUM_TYPES = {"office", "school", "warehouse", "hotel"}

_HIGH_CATS = {"residential", "social", "industrial"}
_MEDIUM_CATS = {"commercial", "mixed"}

_TYPE_LABELS = {
    "apartment_building": "Житловий комплекс",
    "private_house": "Приватний будинок",
    "office": "Офісний центр",
    "shopping_center": "ТРЦ",
    "warehouse": "Склад",
    "factory": "Виробничий об'єкт",
    "hospital": "Лікарня",
    "school": "Школа",
    "hotel": "Готель",
    "infrastructure": "Інфраструктура",
    "other": "Інше",
}

_CAT_LABELS = {
    "residential": "Житловий",
    "commercial": "Комерційний",
    "industrial": "Промисловий",
    "infrastructure": "Інфраструктура",
    "social": "Соціальний",
    "mixed": "Змішаний",
}

_STATUS_LABELS = {
    "planned": "Заплановано",
    "approved": "Затверджено",
    "under_construction": "Будується",
    "completed": "Завершено",
    "suspended": "Призупинено",
    "cancelled": "Скасовано",
}


class PotentialObjectResult(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    oblast: Optional[str] = None
    status: str
    status_label: str = ""
    category: Optional[str] = None
    category_label: Optional[str] = None
    object_type: Optional[str] = None
    object_type_label: Optional[str] = None
    floors: Optional[int] = None
    building_area: Optional[float] = None
    website: Optional[str] = None
    customer: Optional[str] = None
    potential: str = "medium"  # high | medium | low


def _calc_potential(obj: ConstructionObject) -> str:
    type_val = obj.object_type.value if obj.object_type else None
    cat_val = obj.category.value if obj.category else None

    if type_val in _HIGH_TYPES:
        return "high"
    if type_val in _MEDIUM_TYPES:
        return "medium"
    if type_val:
        return "low"

    if cat_val in _HIGH_CATS:
        return "high"
    if cat_val in _MEDIUM_CATS:
        return "medium"
    if cat_val:
        return "low"

    floors = obj.floors or 0
    area = obj.building_area or 0
    if floors >= 10 or area >= 10_000:
        return "high"
    if floors >= 5 or area >= 3_000:
        return "medium"
    return "low"


@router.get("", response_model=list[PotentialObjectResult])
async def list_potential_objects(
    city: Optional[str] = Query(None),
    oblast: Optional[str] = Query(None),
    object_type: Optional[str] = Query(None),
    potential: Optional[str] = Query(None, pattern="^(high|medium|low)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Planned/approved objects without linked tenders — pre-tender pipeline."""
    stmt = (
        select(ConstructionObject)
        .outerjoin(Tender, Tender.object_id == ConstructionObject.id)
        .where(Tender.id.is_(None))
        .where(ConstructionObject.status.in_(["planned", "approved"]))
        .order_by(ConstructionObject.created_at.desc())
    )

    if city:
        stmt = stmt.where(ConstructionObject.city.ilike(f"%{city}%"))
    if oblast:
        stmt = stmt.where(ConstructionObject.oblast.ilike(f"%{oblast}%"))
    if object_type:
        stmt = stmt.where(ConstructionObject.object_type == object_type)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    results = []
    for obj in rows:
        p = _calc_potential(obj)
        if potential and p != potential:
            continue
        type_val = obj.object_type.value if obj.object_type else None
        cat_val = obj.category.value if obj.category else None
        status_val = obj.status.value if obj.status else "planned"
        results.append(PotentialObjectResult(
            id=str(obj.id),
            name=obj.name,
            address=obj.address,
            city=obj.city,
            oblast=obj.oblast,
            status=status_val,
            status_label=_STATUS_LABELS.get(status_val, status_val),
            category=cat_val,
            category_label=_CAT_LABELS.get(cat_val or "", cat_val),
            object_type=type_val,
            object_type_label=_TYPE_LABELS.get(type_val or "", type_val),
            floors=obj.floors,
            building_area=obj.building_area,
            website=obj.website,
            customer=obj.customer,
            potential=p,
        ))

    return results
