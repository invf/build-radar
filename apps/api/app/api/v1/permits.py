"""Permits list endpoint."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import joinedload

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set
from ...models.user import User
from ...models.permit import Permit, PermitType
from ...models.construction_object import ConstructionObject
from ...schemas.permits import PermitSchema, PermitCreateSchema

router = APIRouter(prefix="/permits", tags=["permits"])


@router.post("", response_model=PermitSchema, status_code=201)
async def create_permit(
    body: PermitCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = await db.get(ConstructionObject, body.object_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Об'єкт не знайдено")
    permit = Permit(**body.model_dump())
    db.add(permit)
    await db.commit()
    await db.refresh(permit)
    return PermitSchema.model_validate(permit)


class PermitListSchema(PermitSchema):
    object_name: Optional[str] = None
    object_city: Optional[str] = None


@router.get("")
async def list_permits(
    permit_type: Optional[PermitType] = Query(None),
    city: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("issued_date", pattern="^(issued_date|created_at|permit_number)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"permits:list:{permit_type}:{city}:{date_from}:{date_to}:{search}:{sort_by}:{sort_order}:{page}:{page_size}"
    if cached := await cache_get(cache_key):
        return cached

    stmt = (
        select(Permit, ConstructionObject.name, ConstructionObject.city)
        .join(ConstructionObject, Permit.object_id == ConstructionObject.id)
    )

    if permit_type:
        stmt = stmt.where(Permit.permit_type == permit_type)
    if city:
        stmt = stmt.where(ConstructionObject.city.ilike(f"%{city}%"))
    if search:
        stmt = stmt.where(Permit.permit_number.ilike(f"%{search}%"))

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    order_col = {
        "issued_date": Permit.issued_date,
        "created_at": Permit.created_at,
        "permit_number": Permit.permit_number,
    }.get(sort_by, Permit.issued_date)

    order = desc(order_col) if sort_order == "desc" else asc(order_col)
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(stmt)).all()

    items = []
    for permit, obj_name, obj_city in rows:
        data = PermitSchema.model_validate(permit).model_dump()
        data["object_name"] = obj_name
        data["object_city"] = obj_city
        items.append(data)

    result = {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }
    await cache_set(cache_key, result, ttl=300)
    return result
