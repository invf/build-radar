"""Tenders list endpoint."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.exc import IntegrityError

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set
from ...models.user import User
from ...models.tender import Tender, TenderStatus
from ...models.construction_object import ConstructionObject
from ...schemas.tenders import TenderSchema, TenderCreateSchema, TenderUpdateSchema

router = APIRouter(prefix="/tenders", tags=["tenders"])


@router.post("", response_model=TenderSchema, status_code=201)
async def create_tender(
    body: TenderCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tender = Tender(**body.model_dump())
    db.add(tender)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Tender already exists")
    await db.refresh(tender)
    return TenderSchema.model_validate(tender)


@router.get("")
async def list_tenders(
    status: Optional[TenderStatus] = Query(None),
    search: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|deadline|amount)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"tenders:list:{status}:{search}:{min_amount}:{max_amount}:{sort_by}:{sort_order}:{page}:{page_size}"
    if cached := await cache_get(cache_key):
        return cached

    stmt = (
        select(Tender, ConstructionObject.name, ConstructionObject.city)
        .outerjoin(ConstructionObject, Tender.object_id == ConstructionObject.id)
    )

    if status:
        stmt = stmt.where(Tender.status == status)
    if search:
        stmt = stmt.where(Tender.title.ilike(f"%{search}%"))
    if min_amount is not None:
        stmt = stmt.where(Tender.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(Tender.amount <= max_amount)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    order_col = {
        "created_at": Tender.created_at,
        "deadline": Tender.deadline,
        "amount": Tender.amount,
    }.get(sort_by, Tender.created_at)

    order = desc(order_col) if sort_order == "desc" else asc(order_col)
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(stmt)).all()

    items = []
    for tender, obj_name, obj_city in rows:
        data = TenderSchema.model_validate(tender).model_dump()
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


@router.patch("/{tender_id}", response_model=TenderSchema)
async def update_tender(
    tender_id: uuid.UUID,
    body: TenderUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tender = await db.get(Tender, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tender, field, value)
    await db.commit()
    await db.refresh(tender)
    return TenderSchema.model_validate(tender)


@router.delete("/{tender_id}", status_code=204)
async def delete_tender(
    tender_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    tender = await db.get(Tender, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    await db.delete(tender)
    await db.commit()
