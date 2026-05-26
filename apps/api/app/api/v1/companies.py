"""Companies API endpoints."""
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.orm import selectinload

from ...core.database import get_db
from ...core.dependencies import get_current_user
from ...core.redis import cache_get, cache_set
from ...models.user import User
from ...models.company import Company, CompanyRole, ObjectCompany
from ...models.construction_object import ConstructionObject
from ...models.saved_search import FavoriteCompany
from ...schemas.companies import (
    CompanySchema,
    CompanyDetailSchema,
    CompanyListResponse,
)

router = APIRouter(prefix="/companies", tags=["companies"])

CACHE_TTL = 300  # 5 min


@router.get("", response_model=CompanyListResponse)
async def list_companies(
    search: Optional[str] = Query(None),
    type: Optional[CompanyRole] = Query(None),
    sort_by: str = Query("objects_count", pattern="^(name|objects_count|ai_score|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = f"companies:list:{search}:{type}:{sort_by}:{sort_order}:{page}:{page_size}"
    if cached := await cache_get(cache_key):
        return cached

    # Count subquery: objects per company
    objects_count_sq = (
        select(
            ObjectCompany.company_id,
            func.count(ObjectCompany.id).label("cnt"),
        )
        .group_by(ObjectCompany.company_id)
        .subquery()
    )

    stmt = select(
        Company,
        func.coalesce(objects_count_sq.c.cnt, 0).label("objects_count"),
    ).outerjoin(objects_count_sq, Company.id == objects_count_sq.c.company_id)

    if search:
        stmt = stmt.where(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.edrpou.ilike(f"%{search}%"),
            )
        )
    if type:
        stmt = stmt.where(Company.type == type)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    order_col = {
        "name": Company.name,
        "ai_score": Company.ai_score,
        "created_at": Company.created_at,
        "objects_count": objects_count_sq.c.cnt,
    }.get(sort_by, objects_count_sq.c.cnt)

    order = desc(order_col) if sort_order == "desc" else asc(order_col)
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(stmt)).all()

    items = []
    for company, cnt in rows:
        schema = CompanySchema.model_validate(company)
        schema.objects_count = cnt
        items.append(schema)

    result = CompanyListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )
    await cache_set(cache_key, result.model_dump(mode="json"), ttl=CACHE_TTL)
    return result


@router.get("/{company_id}", response_model=CompanyDetailSchema)
async def get_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"companies:{company_id}"
    if cached := await cache_get(cache_key):
        return cached

    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Компанію не знайдено")

    # objects count
    cnt_result = await db.execute(
        select(func.count(ObjectCompany.id)).where(ObjectCompany.company_id == company_id)
    )
    objects_count = cnt_result.scalar_one()

    # recent objects (last 5)
    recent_result = await db.execute(
        select(ConstructionObject)
        .join(ObjectCompany, ObjectCompany.object_id == ConstructionObject.id)
        .where(ObjectCompany.company_id == company_id)
        .order_by(ConstructionObject.updated_at.desc())
        .limit(5)
    )
    recent_objects = recent_result.scalars().all()

    # is_favorite
    fav = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    is_favorite = fav.scalar_one_or_none() is not None

    schema = CompanyDetailSchema.model_validate(company)
    schema.objects_count = objects_count
    schema.recent_objects = [
        {"id": str(o.id), "name": o.name, "city": o.city, "status": o.status.value}
        for o in recent_objects
    ]
    schema.is_favorite = is_favorite

    await cache_set(cache_key, schema.model_dump(mode="json"), ttl=CACHE_TTL)
    return schema


@router.post("/{company_id}/favorite", status_code=201)
async def favorite_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Вже в обраних")

    fav = FavoriteCompany(user_id=current_user.id, company_id=company_id)
    db.add(fav)
    await db.commit()
    return {"ok": True}


@router.delete("/{company_id}/favorite", status_code=204)
async def unfavorite_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FavoriteCompany).where(
            FavoriteCompany.user_id == current_user.id,
            FavoriteCompany.company_id == company_id,
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="Не знайдено в обраних")

    await db.delete(fav)
    await db.commit()
